import { investorEmail, isLogin, passwordProblem } from "../domain/investors.ts";
import { apiError, json, readJsonBody } from "./http.ts";

/**
 * POST /api/v1/comptes — an operator creates a player's account, or hands a new temporary
 * password. Creating an auth user needs the service key, which never leaves the server: the
 * caller proves it is an operator with its own session token.
 */

export interface AccountDeps {
  /** Set when the deployment lacks a setting (URL, public key, service key). */
  configError?: string;
  /** Who holds the session token, and whether they are an operator. */
  caller(token: string): Promise<{ userId: string; isAdmin: boolean } | null>;
  findAccount(login: string): Promise<{ id: string } | null>;
  createUser(
    email: string,
    password: string,
  ): Promise<{ id: string } | { error: string; code?: string }>;
  deleteUser(id: string): Promise<void>;
  setPassword(id: string, password: string): Promise<{ error: string } | null>;
  insertAccount(row: {
    user_id: string;
    login: string;
    display_name: string;
    created_by: string;
    company_profile_id: number | null;
  }): Promise<{ error: string; code?: string } | null>;
  requirePasswordChange(id: string): Promise<{ error: string } | null>;
  /** Server log; never pass it a password or a token. */
  log(message: string, detail?: unknown): void;
}

const MAX_BODY = 2048;
const TOKEN = /^Bearer\s+([A-Za-z0-9._-]{20,4096})$/;

type Body =
  | {
      action: "create";
      login: string;
      displayName: string;
      password: string;
      /** A corporation's own account: the page it belongs to. */
      profileId: string | null;
    }
  | { action: "reset"; login: string; password: string };

/** The request body, checked; or the reasons it is refused. */
export function readAccountBody(
  value: unknown,
): { ok: true; body: Body } | { ok: false; details: string[] } {
  const v = (value ?? {}) as Record<string, unknown>;
  const details: string[] = [];
  const login = typeof v.login === "string" ? v.login.trim() : "";
  const password = typeof v.password === "string" ? v.password : "";
  if (!isLogin(login)) details.push("identifiant : cinq chiffres");
  const problem = passwordProblem(password, isLogin(login) ? login : null);
  if (problem) details.push(`mot de passe : ${problem}`);
  if (v.action === "create") {
    const displayName = typeof v.displayName === "string" ? v.displayName.trim() : "";
    if (displayName.length < 1 || displayName.length > 60)
      details.push("nom du personnage : de 1 à 60 caractères");
    const raw = v.profileId;
    const profileId =
      typeof raw === "string" && raw !== ""
        ? raw
        : typeof raw === "number" && Number.isInteger(raw)
          ? String(raw)
          : null;
    if (raw != null && raw !== "" && (profileId === null || !/^\d{1,18}$/.test(profileId)))
      details.push("corporation inconnue");
    return details.length > 0
      ? { ok: false, details }
      : { ok: true, body: { action: "create", login, displayName, password, profileId } };
  }
  if (v.action === "reset")
    return details.length > 0
      ? { ok: false, details }
      : { ok: true, body: { action: "reset", login, password } };
  return { ok: false, details: ["action : « create » ou « reset »", ...details] };
}

export async function handleAccounts(request: Request, deps: AccountDeps): Promise<Response> {
  if (request.method !== "POST")
    return apiError(405, "methode_non_autorisee", "Utilisez POST.", { Allow: "POST" });
  if (deps.configError) {
    deps.log(deps.configError);
    return apiError(500, "service_non_configure", deps.configError);
  }
  const token = TOKEN.exec(request.headers.get("Authorization")?.trim() ?? "")?.[1];
  if (!token) return apiError(401, "session_absente", "Connectez-vous comme opérateur.");
  const caller = await deps.caller(token);
  if (!caller) return apiError(401, "session_invalide", "Session expirée : reconnectez-vous.");
  if (!caller.isAdmin) return apiError(403, "reserve_operateurs", "Réservé aux opérateurs de KNX.");

  const raw = await readJsonBody(request, MAX_BODY);
  if (!raw.ok)
    return apiError(400, "corps_invalide", "Corps de requête JSON invalide ou trop long.");
  const read = readAccountBody(raw.value);
  if (!read.ok) return apiError(422, "demande_invalide", "Demande refusée.", {}, read.details);
  const { body } = read;

  if (body.action === "reset") {
    const account = await deps.findAccount(body.login);
    if (!account) return apiError(404, "compte_introuvable", `Aucun compte ${body.login}.`);
    const failed =
      (await deps.setPassword(account.id, body.password)) ??
      (await deps.requirePasswordChange(account.id));
    if (failed) {
      deps.log("réinitialisation refusée", failed.error);
      return apiError(
        502,
        "echec_service",
        "Le service d'authentification a refusé le changement.",
      );
    }
    return json(200, { ok: true, login: body.login });
  }

  if (await deps.findAccount(body.login))
    return apiError(409, "identifiant_pris", `L'identifiant ${body.login} est déjà pris.`);
  const created = await deps.createUser(investorEmail(body.login), body.password);
  if ("error" in created) {
    if (created.code === "email_exists")
      return apiError(409, "identifiant_pris", `L'identifiant ${body.login} est déjà pris.`);
    deps.log("création refusée", created.error);
    return apiError(502, "echec_service", "Le service d'authentification a refusé le compte.");
  }
  const inserted = await deps.insertAccount({
    user_id: created.id,
    login: body.login,
    display_name: body.displayName,
    created_by: caller.userId,
    company_profile_id: body.profileId === null ? null : Number(body.profileId),
  });
  if (inserted) {
    // No account row: the auth user would be an orphan that cannot sign in to anything.
    await deps.deleteUser(created.id);
    deps.log("compte non enregistré", inserted.error);
    return inserted.code === "23505"
      ? apiError(
          409,
          "identifiant_pris",
          `L'identifiant ${body.login} est déjà pris, ou la corporation a déjà son compte.`,
        )
      : apiError(500, "echec_enregistrement", "Le compte n'a pas pu être enregistré.");
  }
  return json(201, { ok: true, account: { id: created.id, login: body.login } });
}
