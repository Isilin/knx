import type { Dataset, Snapshot } from "../domain/types.ts";
import type { DataSource, PublishRequest, Session } from "./source.ts";

const STORAGE_KEY = "knx.local-snapshots";
const SUPABASE_ONLY =
  "Mode local : les envois du module de jeu et ses clés demandent la base Supabase.";

function readLocal(): Snapshot[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Snapshot[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(snapshots: Snapshot[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots));
  } catch {
    throw new Error(
      "Impossible d'enregistrer le relevé dans ce navigateur (stockage indisponible).",
    );
  }
}

/**
 * Local data source: the imported history served as a static file, plus reports typed in this
 * browser. Used in development and whenever Supabase is not configured.
 */
export function createLocalSource(): DataSource {
  return {
    kind: "local",
    async load() {
      const response = await fetch(`${import.meta.env.BASE_URL}data/history.json`);
      if (!response.ok) throw new Error(`Historique introuvable (${response.status}).`);
      const dataset = (await response.json()) as Dataset;
      const local = readLocal();
      if (local.length === 0) return dataset;
      const byDate = new Map(dataset.snapshots.map((s) => [s.date, s]));
      for (const snapshot of local) byDate.set(snapshot.date, snapshot);
      const names = new Set(dataset.companies.map((c) => c.name));
      const companies = [...dataset.companies];
      for (const s of local)
        for (const r of s.rows)
          if (!names.has(r.name)) {
            names.add(r.name);
            companies.push({ name: r.name });
          }
      return { ...dataset, companies, snapshots: [...byDate.values()] };
    },
    async publish(request: PublishRequest) {
      const local = readLocal().filter((s) => s.date !== request.date);
      local.push({ date: request.date, source: request.source, rows: request.rows });
      writeLocal(local);
    },
    async session(): Promise<Session> {
      return { state: "signed-in", email: "mode local", isAdmin: true };
    },
    async requestSignIn() {},
    async signInWithPassword() {},
    async signOut() {},
    onSessionChange() {
      return () => {};
    },
    // The in-game module and its keys live in Supabase only.
    async pending() {
      return [];
    },
    async publishPending() {
      throw new Error(SUPABASE_ONLY);
    },
    async rejectPending() {
      throw new Error(SUPABASE_ONLY);
    },
    async apiKeys() {
      return [];
    },
    async createApiKey() {
      throw new Error(SUPABASE_ONLY);
    },
    async revokeApiKey() {
      throw new Error(SUPABASE_ONLY);
    },
  };
}
