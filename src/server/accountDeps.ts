import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AccountDeps } from "./accounts.ts";

type Env = Readonly<Record<string, string | undefined>>;

/**
 * Wires account creation to Supabase. The service key (`SUPABASE_SERVICE_ROLE_KEY`, or
 * `SUPABASE_SECRET_KEY` in the newer naming) stays on the server; the caller's own session token
 * is checked with the public key.
 */
export function createAccountDeps(env: Env): AccountDeps {
  const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const publicKey =
    env.SUPABASE_PUBLISHABLE_KEY ??
    env.SUPABASE_ANON_KEY ??
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY;
  const configError =
    !url || !publicKey
      ? "Variables Supabase absentes (URL ou clé publique) pour l'API KNX."
      : !serviceKey
        ? "Clé de service Supabase absente : ajoutez SUPABASE_SERVICE_ROLE_KEY aux variables du projet Vercel."
        : undefined;

  const options = {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  };
  let service: SupabaseClient | null = null;
  const admin = () => (service ??= createClient(url ?? "", serviceKey ?? "", options));

  return {
    configError,
    log: (message, detail) => console.error(`[knx-comptes] ${message}`, detail ?? ""),
    async caller(token) {
      const client = createClient(url ?? "", publicKey ?? "", {
        ...options,
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data, error } = await client.auth.getUser(token);
      if (error || !data.user) return null;
      const { data: isAdmin } = await client.rpc("is_admin");
      return { userId: data.user.id, isAdmin: isAdmin === true };
    },
    async findAccount(login) {
      const { data } = await admin()
        .from("investor_accounts")
        .select("user_id")
        .eq("login", login)
        .maybeSingle();
      const row = data as { user_id: string } | null;
      return row ? { id: row.user_id } : null;
    },
    async createUser(email, password) {
      const { data, error } = await admin().auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error || !data.user)
        return { error: error?.message ?? "aucun utilisateur", code: error?.code };
      return { id: data.user.id };
    },
    async deleteUser(id) {
      await admin().auth.admin.deleteUser(id);
    },
    async setPassword(id, password) {
      const { error } = await admin().auth.admin.updateUserById(id, { password });
      return error ? { error: error.message } : null;
    },
    async insertAccount(row) {
      const { error } = await admin().from("investor_accounts").insert(row);
      return error ? { error: error.message, code: error.code } : null;
    },
    async requirePasswordChange(id) {
      const { error } = await admin()
        .from("investor_accounts")
        .update({ must_change_password: true })
        .eq("user_id", id);
      return error ? { error: error.message } : null;
    },
  };
}
