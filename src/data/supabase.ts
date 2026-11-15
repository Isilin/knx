import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cleanMarketEvent, normalizeDataset } from "../domain/mutations.ts";
import { VALUATION_METHOD } from "../domain/valuation.ts";
import type {
  ApiKey,
  CreatedApiKey,
  DataSource,
  PendingSnapshot,
  ResolvedRows,
  Session,
} from "./source.ts";

const LOGO_BUCKET = "company-logos";

/** Supabase Auth errors, said in the operator's terms. */
function signInMessage(error: { message: string; status?: number; code?: string }): string {
  if (error.code === "over_email_send_rate_limit" || error.status === 429) {
    return "trop de liens demandés. Le service d'e-mail intégré de Supabase n'en envoie que 2 par heure pour tout le projet ; réessayez dans une heure, ou configurez un SMTP dans Supabase pour lever cette limite.";
  }
  if (error.code === "otp_disabled" || /signups not allowed/i.test(error.message)) {
    return "cette adresse n'a pas de compte opérateur. Un administrateur doit d'abord l'inviter dans Supabase.";
  }
  if (error.code === "invalid_credentials" || /invalid login credentials/i.test(error.message)) {
    return "adresse ou mot de passe incorrect.";
  }
  if (error.code === "email_not_confirmed") {
    return "ce compte n'est pas confirmé. Dans Supabase, confirmez l'utilisateur ou recréez-le avec « Auto Confirm User ».";
  }
  return error.message;
}

/** Database errors, said in the operator's terms. */
function writeMessage(error: { message: string; code?: string }, duplicate?: string): Error {
  if (error.code === "23505" && duplicate) return new Error(duplicate);
  if (error.code === "42501" || /row-level security/i.test(error.message))
    return new Error("modification réservée aux opérateurs.");
  return new Error(error.message);
}

/** A resolved report row, as the publication functions read it. */
function rowPayload(r: ResolvedRows["rows"][number]) {
  return {
    company_id: r.companyId,
    profile_id: r.profileId ?? null,
    name: r.name,
    rank: r.rank,
    chiffre: r.chiffre,
    capital: r.capital,
    employees: r.employees,
  };
}

/** Missing table: Postgres says 42P01, PostgREST's schema cache PGRST205. */
function isMissingTable(error: { code?: string }): boolean {
  return error.code === "42P01" || error.code === "PGRST205";
}

const MISSING_PRICE_TABLES =
  "tables du cours théorique absentes : exécuter la migration 20261120000000_cours_theorique.sql.";

/** Path of an uploaded logo inside the bucket, from its public URL. */
function logoPath(url: string | null): string | null {
  const marker = `/storage/v1/object/public/${LOGO_BUCKET}/`;
  const at = url?.indexOf(marker) ?? -1;
  return url && at >= 0 ? decodeURIComponent(url.slice(at + marker.length)) : null;
}

export function createSupabaseSource(url: string, key: string): DataSource {
  const client: SupabaseClient = createClient(url, key, {
    auth: { persistSession: true, detectSessionInUrl: true },
  });

  /** Updates one row; RLS turns a refused update into zero rows, so check for one. */
  async function updateRow(
    table: "companies" | "company_profiles",
    id: string,
    values: Record<string, unknown>,
  ): Promise<void> {
    const { data, error } = await client.from(table).update(values).eq("id", id).select("id");
    // Missing table: Postgres says 42P01, PostgREST's schema cache PGRST205.
    if (error?.code === "42P01" || error?.code === "PGRST205")
      throw new Error(
        "table des fiches absente : exécuter la migration 20261118000000_fiches_vies.sql.",
      );
    if (error) throw writeMessage(error);
    if (!data || data.length === 0)
      throw new Error("modification refusée ou corporation introuvable.");
  }

  return {
    kind: "supabase",
    async load() {
      const [dataset, settings, operations] = await Promise.all([
        client.rpc("market_dataset"),
        client
          .from("valuation_settings")
          .select("id, published_on, method, params, note")
          .order("published_on")
          .order("id"),
        client
          .from("security_operations")
          .select("id, company_id, occurred_on, kind, shares, ratio, note")
          .order("occurred_on")
          .order("id"),
      ]);
      if (dataset.error)
        throw new Error(`Lecture des relevés impossible : ${dataset.error.message}`);
      // Before the migration of the theoretical price, the site runs on the default settings.
      const optional = <T>(
        result: { data: T[] | null; error: { message: string; code?: string } | null },
        what: string,
      ): T[] => {
        if (!result.error) return result.data ?? [];
        if (isMissingTable(result.error)) return [];
        throw new Error(`Lecture ${what} impossible : ${result.error.message}`);
      };
      return normalizeDataset({
        ...(dataset.data as object),
        valuationSettings: optional(settings, "des réglages du cours").map((r) => ({
          id: String(r.id),
          date: r.published_on,
          method: r.method,
          params: r.params,
          note: r.note,
        })),
        securityOperations: optional(operations, "des opérations sur titres").map((r) => ({
          id: String(r.id),
          companyId: String(r.company_id),
          date: r.occurred_on,
          kind: r.kind,
          shares: r.shares,
          ratio: r.ratio,
          note: r.note,
        })),
      });
    },
    async publish(request) {
      const { error } = await client.rpc("publish_snapshot", {
        p_taken_on: request.date,
        p_source: request.source,
        p_rows: request.rows.map(rowPayload),
        p_closures: request.closures.map(Number),
        p_replace: request.replace,
      });
      if (error) throw new Error(error.message);
    },
    async withdrawSnapshot(date) {
      const { error } = await client.rpc("withdraw_snapshot", { p_taken_on: date });
      if (error) throw new Error(error.message);
    },
    async updateCompany(id, patch) {
      if (patch.creationOverride === undefined) return;
      await updateRow("companies", id, { creation_override: patch.creationOverride });
    },
    async updateProfile(id, patch) {
      const values: Record<string, unknown> = {};
      if (patch.sector !== undefined) values.sector = patch.sector;
      if (patch.district !== undefined) values.district = patch.district;
      if (patch.hidden !== undefined) values.hidden = patch.hidden;
      await updateRow("company_profiles", id, values);
    },
    async setMemberships(profileId, periods) {
      const { error } = await client.rpc("set_memberships", {
        p_profile_id: Number(profileId),
        p_periods: periods.map((m) => ({
          consortium_id: Number(m.consortiumId),
          joined_on: m.joinedOn,
          left_on: m.leftOn,
        })),
      });
      // Missing function: PostgREST says PGRST202.
      if (error?.code === "PGRST202")
        throw new Error(
          "adhésions datées absentes : exécuter la migration 20261119000000_adhesions_consortiums.sql.",
        );
      if (error?.code === "23P01")
        throw new Error(
          "deux périodes se chevauchent : une corporation n'appartient qu'à un consortium à la fois.",
        );
      if (error) throw writeMessage(error);
    },
    async setLogo(id, logo) {
      const { data: row } = await client
        .from("company_profiles")
        .select("logo_url")
        .eq("id", id)
        .single();
      const previous = logoPath((row as { logo_url: string | null } | null)?.logo_url ?? null);
      let next: string | null = null;
      if (logo) {
        const path = `${id}/${crypto.randomUUID()}.webp`;
        const { error } = await client.storage.from(LOGO_BUCKET).upload(path, logo, {
          contentType: logo.type || "image/webp",
          cacheControl: "31536000",
        });
        if (error) throw writeMessage(error);
        next = client.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl;
      }
      await updateRow("company_profiles", id, { logo_url: next });
      // The former file is no longer referenced; failing to remove it only leaves a stray file.
      if (previous) await client.storage.from(LOGO_BUCKET).remove([previous]);
    },
    async saveConsortium({ id, name, color }) {
      const values = { name: name.trim(), color };
      const duplicate = `un consortium s'appelle déjà « ${values.name} »`;
      const { error } =
        id === null
          ? await client.from("consortiums").insert(values)
          : await client.from("consortiums").update(values).eq("id", id);
      if (error) throw writeMessage(error, duplicate);
    },
    async deleteConsortium(id) {
      const { error } = await client.from("consortiums").delete().eq("id", id);
      if (error) throw writeMessage(error);
    },
    async saveEvent({ id, companyId, date, kind, details, note }) {
      const values = {
        company_id: Number(companyId),
        occurred_on: date,
        kind,
        details,
        note,
      };
      const { error } =
        id === null
          ? await client.from("company_events").insert(values)
          : await client.from("company_events").update(values).eq("id", id);
      if (error) throw writeMessage(error);
    },
    async deleteEvent(id) {
      const { error } = await client.from("company_events").delete().eq("id", id);
      if (error) throw writeMessage(error);
    },
    async saveMarketEvent(draft) {
      const { id, date, label, title, description, span } = cleanMarketEvent(draft);
      const values = { occurred_on: date, label, title, description, span_days: span };
      const { error } =
        id === null
          ? await client.from("market_events").insert(values)
          : await client.from("market_events").update(values).eq("id", id);
      // Missing table: Postgres says 42P01, PostgREST's schema cache PGRST205.
      if (error)
        throw error.code === "42P01" || error.code === "PGRST205"
          ? new Error(
              "table des évènements de marché absente : exécuter la migration 20261115000000_evenements_marche.sql.",
            )
          : writeMessage(error);
    },
    async deleteMarketEvent(id) {
      const { error } = await client.from("market_events").delete().eq("id", id);
      if (error) throw writeMessage(error);
    },
    async publishRating(draft) {
      const { error } = await client.from("company_ratings").insert({
        company_id: Number(draft.companyId),
        rated_on: draft.date,
        method: draft.method,
        category: draft.category,
        confidence: draft.confidence,
        outlook: draft.outlook,
        score: draft.score,
        axes: draft.axes,
        criteria: draft.criteria,
        inputs: draft.inputs,
        district: draft.district,
        rationale: draft.rationale,
      });
      if (error)
        throw error.code === "42P01" || error.code === "PGRST205"
          ? new Error(
              "table des notations absente : exécuter la migration 20261117000000_notation_agence.sql.",
            )
          : writeMessage(error, "une notation existe déjà à cette date : retirez-la d'abord");
    },
    async deleteRating(id) {
      const { error } = await client.from("company_ratings").delete().eq("id", id);
      if (error) throw writeMessage(error);
    },
    async publishValuationSettings(draft) {
      const { error } = await client.from("valuation_settings").insert({
        published_on: draft.date,
        method: VALUATION_METHOD,
        params: draft.params,
        note: draft.note,
      });
      if (error)
        throw isMissingTable(error) ? new Error(MISSING_PRICE_TABLES) : writeMessage(error);
    },
    async saveSecurityOperation({ id, companyId, date, kind, shares, ratio, note }) {
      const values = {
        company_id: Number(companyId),
        occurred_on: date,
        kind,
        shares,
        ratio,
        note,
      };
      const { error } =
        id === null
          ? await client.from("security_operations").insert(values)
          : await client.from("security_operations").update(values).eq("id", id);
      if (error)
        throw isMissingTable(error) ? new Error(MISSING_PRICE_TABLES) : writeMessage(error);
    },
    async deleteSecurityOperation(id) {
      const { error } = await client.from("security_operations").delete().eq("id", id);
      if (error) throw writeMessage(error);
    },
    async session(): Promise<Session> {
      const { data } = await client.auth.getSession();
      const user = data.session?.user;
      if (!user) return { state: "anonymous" };
      const { data: isAdmin } = await client.rpc("is_admin");
      return { state: "signed-in", email: user.email ?? "", isAdmin: Boolean(isAdmin) };
    },
    async requestSignIn(email: string) {
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/releves`, shouldCreateUser: false },
      });
      if (error) throw new Error(signInMessage(error));
    },
    async signInWithPassword(email: string, password: string) {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw new Error(signInMessage(error));
    },
    async signOut() {
      await client.auth.signOut();
    },
    onSessionChange(listener) {
      const { data } = client.auth.onAuthStateChange(() => listener());
      return () => data.subscription.unsubscribe();
    },
    async pending() {
      const { data, error } = await client.rpc("pending_snapshots");
      if (error) throw new Error(`Lecture des envois en attente impossible : ${error.message}`);
      return data as PendingSnapshot[];
    },
    async publishPending(id, resolved) {
      const { error } = await client.rpc("publish_pending_snapshot", {
        p_id: id,
        p_rows: resolved.rows.map(rowPayload),
        p_closures: resolved.closures.map(Number),
      });
      if (error) throw new Error(error.message);
    },
    async rejectPending(id: number) {
      const { error } = await client.rpc("reject_pending_snapshot", { p_id: id });
      if (error) throw new Error(error.message);
    },
    async apiKeys() {
      const { data, error } = await client.rpc("list_api_keys");
      if (error) throw new Error(`Lecture des clés impossible : ${error.message}`);
      return data as ApiKey[];
    },
    async createApiKey(name: string) {
      const { data, error } = await client.rpc("create_api_key", { p_name: name });
      if (error) throw new Error(error.message);
      return data as CreatedApiKey;
    },
    async revokeApiKey(id: number) {
      const { error } = await client.rpc("revoke_api_key", { p_id: id });
      if (error) throw new Error(error.message);
    },
  };
}
