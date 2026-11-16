import { describe, expect, it } from "vite-plus/test";
import { handleAccounts, type AccountDeps } from "./accounts.ts";

const TOKEN = "eyJhbGciOiJIUzI1NiJ9.session-token.signature";
const PASSWORD = "Raffinerie-du-Secteur-9";

interface Fake extends AccountDeps {
  users: Map<string, string>;
  accounts: Map<string, string>;
  deleted: string[];
  logs: string[];
}

function fake(overrides: Partial<AccountDeps> = {}, admin = true): Fake {
  const users = new Map<string, string>();
  const accounts = new Map<string, string>();
  const deleted: string[] = [];
  const logs: string[] = [];
  return {
    users,
    accounts,
    deleted,
    logs,
    log: (message) => logs.push(message),
    async caller(token) {
      return token === TOKEN ? { userId: "operator", isAdmin: admin } : null;
    },
    async findAccount(login) {
      const id = accounts.get(login);
      return id ? { id } : null;
    },
    async createUser(email, password) {
      const id = `user-${users.size + 1}`;
      users.set(id, `${email}:${password}`);
      return { id };
    },
    async deleteUser(id) {
      deleted.push(id);
    },
    async setPassword(id, password) {
      users.set(id, `${users.get(id)?.split(":")[0]}:${password}`);
      return null;
    },
    async insertAccount(row) {
      accounts.set(row.login, row.user_id);
      return null;
    },
    async requirePasswordChange() {
      return null;
    },
    ...overrides,
  };
}

function post(body: unknown, token: string | null = TOKEN): Request {
  return new Request("https://knx.example/api/v1/comptes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

const create = { action: "create", login: "04217", displayName: "Ilsa Varn", password: PASSWORD };

describe("POST /api/v1/comptes", () => {
  it("creates the auth user and the account for an operator", async () => {
    const deps = fake();
    const response = await handleAccounts(post(create), deps);
    expect(response.status).toBe(201);
    expect(deps.users.get("user-1")).toBe(`knx-04217@example.com:${PASSWORD}`);
    expect(deps.accounts.get("04217")).toBe("user-1");
  });

  it("turns away a missing session, an unknown one, and a player", async () => {
    expect((await handleAccounts(post(create, null), fake())).status).toBe(401);
    expect((await handleAccounts(post(create, `${TOKEN}x`), fake())).status).toBe(401);
    expect((await handleAccounts(post(create), fake({}, false))).status).toBe(403);
  });

  it("explains a refused request without touching anything", async () => {
    const deps = fake();
    const response = await handleAccounts(
      post({ action: "create", login: "42", displayName: "", password: "court" }),
      deps,
    );
    expect(response.status).toBe(422);
    const body = (await response.json()) as { error: { details: string[] } };
    expect(body.error.details).toHaveLength(3);
    expect(deps.users.size).toBe(0);
  });

  it("refuses a login already taken", async () => {
    const deps = fake();
    deps.accounts.set("04217", "user-9");
    expect((await handleAccounts(post(create), deps)).status).toBe(409);
    expect(deps.users.size).toBe(0);
  });

  it("removes the auth user when the account cannot be recorded", async () => {
    const deps = fake({ insertAccount: async () => ({ error: "boom", code: "XX000" }) });
    const response = await handleAccounts(post(create), deps);
    expect(response.status).toBe(500);
    expect(deps.deleted).toEqual(["user-1"]);
  });

  it("hands a new temporary password to an existing account", async () => {
    const deps = fake();
    deps.accounts.set("04217", "user-1");
    deps.users.set("user-1", "knx-04217@example.com:ancien");
    const response = await handleAccounts(
      post({ action: "reset", login: "04217", password: PASSWORD }),
      deps,
    );
    expect(response.status).toBe(200);
    expect(deps.users.get("user-1")).toBe(`knx-04217@example.com:${PASSWORD}`);
    expect(
      (await handleAccounts(post({ action: "reset", login: "99999", password: PASSWORD }), deps))
        .status,
    ).toBe(404);
  });

  it("says when the deployment lacks its service key", async () => {
    const deps = fake({ configError: "Clé de service Supabase absente" });
    const response = await handleAccounts(post(create), deps);
    expect(response.status).toBe(500);
    expect(((await response.json()) as { error: { message: string } }).error.message).toMatch(
      /service/,
    );
  });
});

describe("corporation accounts", () => {
  it("ties the account to its page, and refuses an unknown page", async () => {
    const rows: { company_profile_id: number | null }[] = [];
    const deps = fake({
      insertAccount: async (row) => {
        rows.push(row);
        return null;
      },
    });
    const ok = await handleAccounts(post({ ...create, profileId: "42" }), deps);
    expect(ok.status).toBe(201);
    expect(rows[0].company_profile_id).toBe(42);
    const bad = await handleAccounts(post({ ...create, login: "04218", profileId: "abc" }), fake());
    expect(bad.status).toBe(422);
  });
});
