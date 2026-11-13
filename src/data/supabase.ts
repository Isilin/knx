import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeDataset } from "../domain/mutations.ts";
import type { DataSource, Session } from "./source.ts";

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

  /** Updates one corporation; RLS turns a refused update into zero rows, so check for one. */
  async function updateCompanyRow(id: string, values: Record<string, unknown>): Promise<void> {
    const { data, error } = await client.from("companies").update(values).eq("id", id).select("id");
    if (error) throw writeMessage(error);
    if (!data || data.length === 0)
      throw new Error("modification refusée ou corporation introuvable.");
  }

  return {
    kind: "supabase",
    async load() {
      const { data, error } = await client.rpc("market_dataset");
      if (error) throw new Error(`Lecture des relevés impossible : ${error.message}`);
      return normalizeDataset(data);
    },
    async publish(request) {
      const { error } = await client.rpc("publish_snapshot", {
        p_taken_on: request.date,
        p_source: request.source,
        p_rows: request.rows.map((r) => ({
          company_id: r.companyId,
          name: r.name,
          rank: r.rank,
          chiffre: r.chiffre,
          capital: r.capital,
          employees: r.employees,
        })),
        p_closures: request.closures.map(Number),
        p_replace: request.replace,
      });
      if (error) throw new Error(error.message);
    },
    async updateCompany(id, patch) {
      const values: Record<string, unknown> = {};
      if (patch.consortiumId !== undefined)
        values.consortium_id = patch.consortiumId === null ? null : Number(patch.consortiumId);
      if (patch.sector !== undefined) values.sector = patch.sector;
      if (patch.creationOverride !== undefined) values.creation_override = patch.creationOverride;
      await updateCompanyRow(id, values);
    },
    async setLogo(id, logo) {
      const { data: row } = await client.from("companies").select("logo_url").eq("id", id).single();
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
      await updateCompanyRow(id, { logo_url: next });
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
  };
}
