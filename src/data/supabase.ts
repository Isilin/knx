import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Dataset } from "../domain/types.ts";
import type { DataSource, PublishRequest, Session } from "./source.ts";

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
      if (error) throw new Error(error.message);
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
