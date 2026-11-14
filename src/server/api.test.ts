import { describe, expect, it } from "vite-plus/test";
import { formatImperialDate } from "../domain/imperial.ts";
import { handleReleves, handleStatus, type ApiDeps, type RpcResult } from "./api.ts";
import { parseCorsOrigins } from "./deps.ts";

const KEY = `knx_${"a1".repeat(32)}`;
const NOW = new Date("2026-11-13T12:00:00Z");
const BASE = "https://knx.example/api/v1";

interface Fake extends ApiDeps {
  calls: { fn: string; args: Record<string, unknown> }[];
  logs: string[];
}

function fakeDeps(
  reply: RpcResult | (() => Promise<RpcResult>),
  overrides: Partial<ApiDeps> = {},
): Fake {
  const calls: Fake["calls"] = [];
  const logs: string[] = [];
  return {
    calls,
    logs,
    corsOrigins: "*",
    now: () => NOW,
    log: (message, detail) => logs.push(`${message} ${JSON.stringify(detail ?? null)}`),
    async rpc(fn, args) {
      calls.push({ fn, args });
      return typeof reply === "function" ? reply() : reply;
    },
    ...overrides,
  };
}

const ok = (data: unknown): RpcResult => ({ data, error: null });

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`${BASE}/releves`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const report = {
  date: "2026-11-13",
  rows: [
    {
      name: "Armacham Technology",
      rank: 1,
      chiffre: "677.085",
      capital: "27.120.847",
      employees: 4,
    },
    { name: "Seven", rank: 2, chiffre: 4_700 },
  ],
};

describe("handleReleves", () => {
  it("answers the CORS preflight without touching the database", async () => {
    const deps = fakeDeps(ok({ outcome: "created" }));
    const response = await handleReleves(
      new Request(`${BASE}/releves`, {
        method: "OPTIONS",
        headers: { Origin: "https://www.dreadcast.net" },
      }),
      deps,
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("POST, OPTIONS");
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe(
      "Authorization, Content-Type",
    );
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBeNull();
    expect(deps.calls).toHaveLength(0);
  });

  it("echoes only listed origins", async () => {
    const deps = fakeDeps(ok({ outcome: "created" }), {
      corsOrigins: parseCorsOrigins("https://www.dreadcast.net, https://dreadcast.net"),
    });
    const allowed = await handleReleves(post(report, { Origin: "https://dreadcast.net" }), deps);
    expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe("https://dreadcast.net");
    expect(allowed.headers.get("Vary")).toBe("Origin");
    const refused = await handleReleves(post(report, { Origin: "https://evil.example" }), deps);
    expect(refused.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("refuses other methods", async () => {
    const response = await handleReleves(new Request(`${BASE}/releves`), fakeDeps(ok({})));
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST, OPTIONS");
    expect((await response.json()).error.code).toBe("methode_non_autorisee");
  });

  it("rejects missing or malformed keys before any database call", async () => {
    const deps = fakeDeps(ok({ outcome: "created" }));
    const missing = await handleReleves(post(report, { Authorization: "" }), deps);
    expect(missing.status).toBe(401);
    expect(missing.headers.get("WWW-Authenticate")).toBe('Bearer realm="knx"');
    expect((await missing.json()).error.code).toBe("cle_absente");
    for (const bad of ["Bearer knx_123", `Basic ${KEY}`, `Bearer ${KEY.toUpperCase()}`]) {
      const response = await handleReleves(post(report, { Authorization: bad }), deps);
      expect(response.status).toBe(401);
      expect((await response.json()).error.code).toBe("cle_invalide");
    }
    expect(deps.calls).toHaveLength(0);
  });

  it("refuses oversized and unreadable bodies", async () => {
    const deps = fakeDeps(ok({ outcome: "created" }));
    const big = await handleReleves(post({ ...report, pad: "x".repeat(70_000) }), deps);
    expect(big.status).toBe(413);
    expect((await big.json()).error.code).toBe("trop_volumineux");
    const declared = await handleReleves(post(report, { "Content-Length": "999999" }), deps);
    expect(declared.status).toBe(413);
    const broken = await handleReleves(post("{ date: "), deps);
    expect(broken.status).toBe(400);
    expect((await broken.json()).error.code).toBe("requete_invalide");
    expect(deps.calls).toHaveLength(0);
  });

  it("returns every validation error with a 422", async () => {
    const deps = fakeDeps(ok({ outcome: "created" }));
    const response = await handleReleves(
      post({ date: "2026-12-01", rows: [{ name: "A", chiffre: -1 }] }),
      deps,
    );
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("releve_invalide");
    expect(body.error.details).toHaveLength(2);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(deps.calls).toHaveLength(0);
  });

  it("sends the normalised report with the key", async () => {
    const deps = fakeDeps(ok({ outcome: "created", snapshotId: 7 }));
    const response = await handleReleves(post(report), deps);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      ok: true,
      status: "pending",
      outcome: "created",
      date: "2026-11-13",
      rows: 2,
      message: `Relevé du ${formatImperialDate("2026-11-13")} reçu : en attente de validation.`,
    });
    expect(deps.calls).toEqual([
      {
        fn: "ingest_snapshot",
        args: {
          p_key: KEY,
          p_taken_on: "2026-11-13",
          p_rows: [
            {
              name: "Armacham Technology",
              rank: 1,
              chiffre: 677_085,
              capital: 27_120_847,
              employees: 4,
            },
            { name: "Seven", rank: 2, chiffre: 4_700, capital: null, employees: null },
          ],
        },
      },
    ]);
  });

  it.each([
    ["replaced", 200, null],
    ["unchanged", 200, null],
    ["published", 409, "deja_publie"],
    ["pending_other_key", 409, "deja_en_attente"],
    ["busy", 409, "deja_en_attente"],
    ["unauthorized", 401, "cle_invalide"],
    ["invalid", 422, "releve_invalide"],
    ["surprise", 500, "erreur_interne"],
  ])("maps the %s outcome to %i", async (outcome, status, code) => {
    const response = await handleReleves(post(report), fakeDeps(ok({ outcome })));
    expect(response.status).toBe(status);
    const body = await response.json();
    if (code) expect(body.error.code).toBe(code);
    else expect(body).toMatchObject({ ok: true, outcome, status: "pending" });
  });

  it("hides database failures and never logs the key", async () => {
    const failing = fakeDeps({ data: null, error: { message: "boom", code: "XX000" } });
    const response = await handleReleves(post(report), failing);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      ok: false,
      error: { code: "erreur_interne", message: "Erreur interne de KNX ; réessayez plus tard." },
    });
    expect(failing.logs.join("\n")).toContain("boom");

    const throwing = fakeDeps(() => Promise.reject(new Error("réseau coupé")));
    expect((await handleReleves(post(report), throwing)).status).toBe(500);
    expect([...failing.logs, ...throwing.logs].join("\n")).not.toContain(KEY);
  });

  it("says when the deployment lacks its settings", async () => {
    const deps = fakeDeps(ok({}), { configError: "Variables Supabase absentes" });
    const response = await handleReleves(post(report), deps);
    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("service_non_configure");
    expect(deps.calls).toHaveLength(0);
  });
});

describe("handleStatus", () => {
  const get = (query = "", headers: Record<string, string> = {}) =>
    new Request(`${BASE}/status${query}`, {
      headers: { Authorization: `Bearer ${KEY}`, ...headers },
    });

  it("reports the key and today's state (Paris)", async () => {
    const deps = fakeDeps(
      ok({
        outcome: "ok",
        keyName: "Module",
        date: "2026-11-13",
        state: "pending",
        lastPublished: "2026-11-12",
      }),
    );
    const response = await handleStatus(get(), deps);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      key: { name: "Module" },
      date: "2026-11-13",
      state: "pending",
      lastPublished: "2026-11-12",
    });
    expect(deps.calls).toEqual([
      { fn: "api_key_status", args: { p_key: KEY, p_date: "2026-11-13" } },
    ]);
  });

  it("passes an explicit date and checks its format", async () => {
    const deps = fakeDeps(
      ok({ outcome: "ok", keyName: "M", date: "2026-11-10", state: "absent", lastPublished: null }),
    );
    await handleStatus(get("?date=2026-11-10"), deps);
    expect(deps.calls[0].args.p_date).toBe("2026-11-10");
    const bad = await handleStatus(get("?date=hier"), deps);
    expect(bad.status).toBe(400);
  });

  it("rejects unknown keys and other methods", async () => {
    expect((await handleStatus(get(), fakeDeps(ok({ outcome: "unauthorized" })))).status).toBe(401);
    expect((await handleStatus(get("", { Authorization: "" }), fakeDeps(ok({})))).status).toBe(401);
    const posted = await handleStatus(
      new Request(`${BASE}/status`, { method: "POST" }),
      fakeDeps(ok({})),
    );
    expect(posted.status).toBe(405);
    expect(posted.headers.get("Allow")).toBe("GET, OPTIONS");
  });
});

describe("parseCorsOrigins", () => {
  it("defaults to any origin", () => {
    expect(parseCorsOrigins(undefined)).toBe("*");
    expect(parseCorsOrigins(" ")).toBe("*");
    expect(parseCorsOrigins("https://a.example,*")).toBe("*");
    expect(parseCorsOrigins("https://a.example, https://b.example")).toEqual([
      "https://a.example",
      "https://b.example",
    ]);
  });
});
