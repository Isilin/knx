import { isIsoDate, todayIn } from "../domain/dates.ts";
import { formatImperialDate } from "../domain/imperial.ts";
import { INGEST_LIMITS, validateIngest } from "../domain/ingest.ts";
import { apiError, corsHeaders, json, readBearer, readJsonBody, type CorsOrigins } from "./http.ts";

/** The game's day changes at midnight, Paris time. */
export const GAME_TIME_ZONE = "Europe/Paris";

export interface RpcResult {
  data: unknown;
  error: { message: string; code?: string } | null;
}

export interface ApiDeps {
  /** Calls a Postgres function with the public key; the database checks the module key. */
  rpc(fn: "ingest_snapshot" | "api_key_status", args: Record<string, unknown>): Promise<RpcResult>;
  corsOrigins: CorsOrigins;
  /** Set when the deployment lacks its Supabase settings. */
  configError?: string;
  now(): Date;
  /** Server log; never pass it the module key. */
  log(message: string, detail?: unknown): void;
}

type IngestOutcome =
  | "created"
  | "replaced"
  | "unchanged"
  | "published"
  | "pending_other_key"
  | "busy"
  | "unauthorized"
  | "invalid";

const outcomeOf = (data: unknown): string | null =>
  typeof data === "object" && data !== null && "outcome" in data && typeof data.outcome === "string"
    ? data.outcome
    : null;

function unauthorized(code: "cle_absente" | "cle_invalide", cors: Record<string, string>) {
  const message =
    code === "cle_absente"
      ? "Clé du module absente : envoyez « Authorization: Bearer knx_… »."
      : "Clé du module inconnue, mal formée ou révoquée.";
  return apiError(401, code, message, { ...cors, "WWW-Authenticate": 'Bearer realm="knx"' });
}

/** Shared opening of every endpoint: CORS, preflight, method, configuration and key. */
function open(
  request: Request,
  deps: ApiDeps,
  method: "GET" | "POST",
): { response: Response } | { key: string; cors: Record<string, string> } {
  const methods = `${method}, OPTIONS`;
  const cors = corsHeaders(request.headers.get("Origin"), deps.corsOrigins, methods);
  if (request.method === "OPTIONS")
    return { response: new Response(null, { status: 204, headers: cors }) };
  if (request.method !== method) {
    return {
      response: apiError(
        405,
        "methode_non_autorisee",
        `Méthode ${request.method} non prise en charge : utilisez ${method}.`,
        { ...cors, Allow: methods },
      ),
    };
  }
  if (deps.configError) {
    deps.log(deps.configError);
    return { response: apiError(500, "service_non_configure", "Service KNX non configuré.", cors) };
  }
  const bearer = readBearer(request);
  if (!bearer.ok) {
    return {
      response: unauthorized(bearer.reason === "absent" ? "cle_absente" : "cle_invalide", cors),
    };
  }
  return { key: bearer.key, cors };
}

async function callRpc(
  deps: ApiDeps,
  fn: "ingest_snapshot" | "api_key_status",
  args: Record<string, unknown>,
): Promise<{ outcome: string; data: unknown } | null> {
  try {
    const { data, error } = await deps.rpc(fn, args);
    if (error) {
      deps.log(`${fn} a échoué`, { message: error.message, code: error.code });
      return null;
    }
    const outcome = outcomeOf(data);
    if (!outcome) deps.log(`${fn} : réponse inattendue`, data);
    return outcome ? { outcome, data } : null;
  } catch (error) {
    deps.log(`${fn} injoignable`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

const internal = (cors: Record<string, string>) =>
  apiError(500, "erreur_interne", "Erreur interne de KNX ; réessayez plus tard.", cors);

/** `POST /api/v1/releves`: drops the day's report, pending the operator's review. */
export async function handleReleves(request: Request, deps: ApiDeps): Promise<Response> {
  const opened = open(request, deps, "POST");
  if ("response" in opened) return opened.response;
  const { key, cors } = opened;

  const body = await readJsonBody(request, INGEST_LIMITS.maxBodyBytes);
  if (!body.ok) {
    return body.reason === "too-large"
      ? apiError(
          413,
          "trop_volumineux",
          `Corps de plus de ${INGEST_LIMITS.maxBodyBytes} octets.`,
          cors,
        )
      : apiError(400, "requete_invalide", "Corps illisible : JSON attendu.", cors);
  }

  const validation = validateIngest(body.value, todayIn(GAME_TIME_ZONE, deps.now()));
  if (!validation.ok) {
    return apiError(422, "releve_invalide", "Relevé refusé.", cors, validation.errors);
  }
  const { date, rows } = validation.payload;

  const result = await callRpc(deps, "ingest_snapshot", {
    p_key: key,
    p_taken_on: date,
    p_rows: rows,
  });
  if (!result) return internal(cors);

  const day = formatImperialDate(date);
  const accepted = (status: number, message: string) =>
    json(
      status,
      { ok: true, status: "pending", outcome: result.outcome, date, rows: rows.length, message },
      cors,
    );

  switch (result.outcome as IngestOutcome) {
    case "created":
      return accepted(201, `Relevé du ${day} reçu : en attente de validation.`);
    case "replaced":
      return accepted(200, `Relevé du ${day} mis à jour : toujours en attente de validation.`);
    case "unchanged":
      return accepted(200, `Relevé du ${day} déjà reçu à l'identique.`);
    case "published":
      return apiError(409, "deja_publie", `Un relevé est déjà publié pour le ${day}.`, cors);
    case "pending_other_key":
    case "busy":
      return apiError(
        409,
        "deja_en_attente",
        `Un autre envoi attend déjà validation pour le ${day}.`,
        cors,
      );
    case "unauthorized":
      return unauthorized("cle_invalide", cors);
    case "invalid":
      // The database's checks match validateIngest; this means the day turned in between.
      return apiError(422, "releve_invalide", "Relevé refusé par la base.", cors);
    default:
      deps.log("ingest_snapshot : issue inconnue", result.outcome);
      return internal(cors);
  }
}

/** `GET /api/v1/status[?date=AAAA-MM-JJ]`: checks the key and tells where a day's report stands. */
export async function handleStatus(request: Request, deps: ApiDeps): Promise<Response> {
  const opened = open(request, deps, "GET");
  if ("response" in opened) return opened.response;
  const { key, cors } = opened;

  const date = new URL(request.url).searchParams.get("date");
  if (date !== null && !isIsoDate(date)) {
    return apiError(400, "requete_invalide", "Paramètre date attendu au format AAAA-MM-JJ.", cors);
  }

  const result = await callRpc(deps, "api_key_status", {
    p_key: key,
    p_date: date ?? todayIn(GAME_TIME_ZONE, deps.now()),
  });
  if (!result) return internal(cors);
  if (result.outcome === "unauthorized") return unauthorized("cle_invalide", cors);
  if (result.outcome !== "ok") return internal(cors);

  const data = result.data as {
    keyName: string;
    date: string;
    state: "absent" | "pending" | "published";
    lastPublished: string | null;
  };
  return json(
    200,
    {
      ok: true,
      key: { name: data.keyName },
      date: data.date,
      state: data.state,
      lastPublished: data.lastPublished,
    },
    cors,
  );
}
