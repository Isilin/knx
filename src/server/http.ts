/**
 * Small HTTP helpers for the module's API (Vercel Functions, Web `Request`/`Response`).
 * No Node or Vercel import: everything here runs in tests as is.
 */

export type CorsOrigins = "*" | readonly string[];

export interface ApiErrorBody {
  ok: false;
  error: { code: string; message: string; details?: string[] };
}

/** A module key: `knx_` and 64 lowercase hex digits (32 random bytes). */
const BEARER = /^Bearer\s+(knx_[0-9a-f]{64})$/;

/**
 * CORS headers for `origin`. A bearer key, not CORS, protects the API, so `*` is safe; a list
 * narrows which pages may call it with a plain `fetch`. Credentials are never allowed.
 */
export function corsHeaders(
  origin: string | null,
  allowed: CorsOrigins,
  methods: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
  };
  if (allowed === "*") return { ...headers, "Access-Control-Allow-Origin": "*" };
  headers.Vary = "Origin";
  if (origin && allowed.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

export function json(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

export function apiError(
  status: number,
  code: string,
  message: string,
  headers: Record<string, string> = {},
  details?: string[],
): Response {
  const body: ApiErrorBody = {
    ok: false,
    error: details ? { code, message, details } : { code, message },
  };
  return json(status, body, headers);
}

/** The module key from `Authorization: Bearer knx_…`; a malformed key never reaches the database. */
export function readBearer(
  request: Request,
): { ok: true; key: string } | { ok: false; reason: "absent" | "malformed" } {
  const header = request.headers.get("Authorization");
  if (!header) return { ok: false, reason: "absent" };
  const key = BEARER.exec(header.trim())?.[1];
  return key ? { ok: true, key } : { ok: false, reason: "malformed" };
}

export type BodyResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: "too-large" | "invalid-json" };

/** Reads a JSON body of at most `maxBytes` bytes. */
export async function readJsonBody(request: Request, maxBytes: number): Promise<BodyResult> {
  const declared = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false, reason: "too-large" };
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes)
    return { ok: false, reason: "too-large" };
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, reason: "invalid-json" };
  }
}
