import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ApiDeps } from "./api.ts";
import type { CorsOrigins } from "./http.ts";

type Env = Readonly<Record<string, string | undefined>>;

/** `KNX_CORS_ORIGINS`: `*` (default) or a comma-separated list of origins. */
export function parseCorsOrigins(value: string | undefined): CorsOrigins {
  const origins = (value ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return origins.length === 0 || origins.includes("*") ? "*" : origins;
}

/**
 * Wires the API to Supabase from the deployment's settings. Only the public key is used: the
 * Postgres functions check the module key themselves. `env` is passed in so nothing under `src/`
 * reads `process`.
 */
export function createApiDeps(env: Env): ApiDeps {
  const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const key =
    env.SUPABASE_PUBLISHABLE_KEY ??
    env.SUPABASE_ANON_KEY ??
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    env.VITE_SUPABASE_ANON_KEY;

  let client: SupabaseClient | null = null;
  return {
    corsOrigins: parseCorsOrigins(env.KNX_CORS_ORIGINS),
    configError:
      url && key ? undefined : "Variables Supabase absentes (URL ou clé publique) pour l'API KNX.",
    now: () => new Date(),
    log: (message, detail) => console.error(`[knx-api] ${message}`, detail ?? ""),
    async rpc(fn, args) {
      client ??= createClient(url ?? "", key ?? "", {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { data, error } = await client.rpc(fn, args);
      return {
        data: data as unknown,
        error: error ? { message: error.message, code: error.code } : null,
      };
    },
  };
}
