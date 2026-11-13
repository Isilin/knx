import { createLocalSource } from "./local.ts";
import type { DataSource } from "./source.ts";

/**
 * Supabase source behind a dynamic import: the client library only downloads when the site is
 * actually wired to Supabase.
 */
function createLazySupabaseSource(url: string, key: string): DataSource {
  let inner: Promise<DataSource> | null = null;
  const get = () =>
    (inner ??= import("./supabase.ts").then((m) => m.createSupabaseSource(url, key)));
  return {
    kind: "supabase",
    load: async () => (await get()).load(),
    publish: async (request) => (await get()).publish(request),
    updateCompany: async (id, patch) => (await get()).updateCompany(id, patch),
    setLogo: async (id, logo) => (await get()).setLogo(id, logo),
    saveConsortium: async (draft) => (await get()).saveConsortium(draft),
    deleteConsortium: async (id) => (await get()).deleteConsortium(id),
    saveEvent: async (draft) => (await get()).saveEvent(draft),
    deleteEvent: async (id) => (await get()).deleteEvent(id),
    session: async () => (await get()).session(),
    requestSignIn: async (email) => (await get()).requestSignIn(email),
    signInWithPassword: async (email, password) =>
      (await get()).signInWithPassword(email, password),
    signOut: async () => (await get()).signOut(),
    onSessionChange(listener) {
      let unsubscribe = () => {};
      let active = true;
      void get().then((source) => {
        if (active) unsubscribe = source.onSessionChange(listener);
      });
      return () => {
        active = false;
        unsubscribe();
      };
    },
  };
}

/**
 * Picks the data source from the environment. The Vercel ↔ Supabase integration exposes
 * `NEXT_PUBLIC_SUPABASE_*` variables; `VITE_SUPABASE_*` works too. Without them, KNX runs on
 * the imported history.
 */
export function createDataSource(): DataSource {
  const env = import.meta.env;
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const key =
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    env.VITE_SUPABASE_ANON_KEY;
  return url && key ? createLazySupabaseSource(url, key) : createLocalSource();
}

export type {
  CompanyPatch,
  ConsortiumDraft,
  DataSource,
  EventDraft,
  PublishRequest,
  Session,
} from "./source.ts";
