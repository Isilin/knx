import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Dataset } from "../domain/types.ts";
import type {
  ApiKey,
  CreatedApiKey,
  DataSource,
  PendingSnapshot,
  PublishRequest,
  Session,
} from "./source.ts";

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

export function createSupabaseSource(url: string, key: string): DataSource {
  const client: SupabaseClient = createClient(url, key, {
    auth: { persistSession: true, detectSessionInUrl: true },
  });

  return {
    kind: "supabase",
    async load() {
      const { data, error } = await client.rpc("market_dataset");
      if (error) throw new Error(`Lecture des relevés impossible : ${error.message}`);
      return data as Dataset;
    },
    async publish(request: PublishRequest) {
      const { error } = await client.rpc("publish_snapshot", {
        p_taken_on: request.date,
        p_source: request.source,
        p_rows: request.rows,
        p_replace: request.replace,
      });
      if (error) throw new Error(error.message);
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
    async publishPending(id: number) {
      const { error } = await client.rpc("publish_pending_snapshot", { p_id: id });
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
