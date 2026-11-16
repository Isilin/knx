import { applyOp, normalizeDataset, type LocalOp } from "../domain/mutations.ts";
import type { Dataset } from "../domain/types.ts";
import { VALUATION_METHOD } from "../domain/valuation.ts";
import type { DataSource, Session } from "./source.ts";

const STORAGE_KEY = "knx.local-ops";
const SUPABASE_ONLY =
  "Mode local : les envois du module de jeu et ses clés demandent la base Supabase.";

function readOps(): LocalOp[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LocalOp[]) : [];
  } catch {
    return [];
  }
}

function writeOps(ops: LocalOp[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ops));
  } catch {
    throw new Error(
      "Impossible d'enregistrer la modification dans ce navigateur (stockage indisponible ou plein).",
    );
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Lecture de l'image impossible."));
    reader.onerror = () => reject(new Error("Lecture de l'image impossible."));
    reader.readAsDataURL(blob);
  });
}

const INVESTORS_ONLY =
  "Mode local : les comptes investisseurs, qui portent de vrais crédits, demandent la base Supabase.";

const newId = () => `local-${crypto.randomUUID()}`;

/**
 * Local data source: the imported history served as a static file, plus the changes made in this
 * browser, kept as a log of operations. Used in development and whenever Supabase is not
 * configured.
 */
export function createLocalSource(): DataSource {
  let base: Promise<Dataset> | null = null;

  const loadBase = () =>
    (base ??= fetch(`${import.meta.env.BASE_URL}data/history.json`).then(async (response) => {
      if (!response.ok) throw new Error(`Historique introuvable (${response.status}).`);
      return normalizeDataset(await response.json());
    }));

  const current = async (): Promise<Dataset> => {
    let dataset = await loadBase();
    for (const op of readOps()) {
      try {
        dataset = applyOp(dataset, op);
      } catch (error) {
        // The history changed under an old local change: skip it rather than block the site.
        console.warn("Modification locale ignorée :", op.type, error);
      }
    }
    return dataset;
  };

  /** Checks the operation against the current state, then records it. */
  const record = async (op: LocalOp) => {
    applyOp(await current(), op);
    writeOps([...readOps(), op]);
  };

  return {
    kind: "local",
    load: current,
    async publish(request) {
      const newIds = request.rows.filter((r) => r.companyId === null).map(newId);
      await record({ type: "publish", request, newIds });
    },
    withdrawSnapshot: (date) => record({ type: "withdraw", date }),
    updateCompany: (id, { creationOverride }) =>
      record({ type: "updateCompany", id, patch: { creationOverride } }),
    updateProfile: (id, patch) => record({ type: "updateProfile", id, patch }),
    setMemberships: (profileId, periods) =>
      record({
        type: "setMemberships",
        profileId,
        memberships: periods.map((m) => ({ ...m, id: newId(), profileId })),
      }),
    async setLogo(id, logo) {
      await record({ type: "setProfileLogo", id, url: logo ? await blobToDataUrl(logo) : null });
    },
    saveConsortium: ({ id, name, color }) =>
      record({ type: "saveConsortium", consortium: { id: id ?? newId(), name, color } }),
    deleteConsortium: (id) => record({ type: "deleteConsortium", id }),
    saveEvent: ({ id, ...draft }) =>
      record({ type: "saveEvent", event: { ...draft, id: id ?? newId(), origin: "manual" } }),
    deleteEvent: (id) => record({ type: "deleteEvent", id }),
    saveMarketEvent: ({ id, ...draft }) =>
      record({ type: "saveMarketEvent", event: { ...draft, id: id ?? newId() } }),
    deleteMarketEvent: (id) => record({ type: "deleteMarketEvent", id }),
    publishRating: (draft) => record({ type: "saveRating", rating: { ...draft, id: newId() } }),
    deleteRating: (id) => record({ type: "deleteRating", id }),
    publishValuationSettings: (draft) =>
      record({
        type: "publishValuation",
        settings: { ...draft, id: newId(), method: VALUATION_METHOD },
      }),
    saveSecurityOperation: ({ id, ...draft }) =>
      record({ type: "saveOperation", operation: { ...draft, id: id ?? newId() } }),
    deleteSecurityOperation: (id) => record({ type: "deleteOperation", id }),
    saveBalanceSheet: ({ id, ...draft }) =>
      record({ type: "saveBalance", sheet: { ...draft, id: id ?? newId() } }),
    deleteBalanceSheet: (id) => record({ type: "deleteBalance", id }),
    async session(): Promise<Session> {
      return { state: "signed-in", email: "mode local", isAdmin: true, investor: null };
    },
    async requestSignIn() {},
    // Investor accounts hold real credits: they live in Supabase only.
    async signInInvestor() {
      throw new Error(INVESTORS_ONLY);
    },
    async changePassword() {
      throw new Error(INVESTORS_ONLY);
    },
    async cashMovements() {
      return [];
    },
    async requestWithdrawal() {
      throw new Error(INVESTORS_ONLY);
    },
    async cancelWithdrawal() {
      throw new Error(INVESTORS_ONLY);
    },
    async investorAccounts() {
      return [];
    },
    async createInvestorAccount() {
      throw new Error(INVESTORS_ONLY);
    },
    async resetInvestorPassword() {
      throw new Error(INVESTORS_ONLY);
    },
    async recordDeposit() {
      throw new Error(INVESTORS_ONLY);
    },
    async settleWithdrawal() {
      throw new Error(INVESTORS_ONLY);
    },
    async setInsiders() {
      throw new Error(INVESTORS_ONLY);
    },
    async marketSessions() {
      return [];
    },
    async marketOrders() {
      return [];
    },
    async marketTrades() {
      return [];
    },
    async placeOrder() {
      throw new Error(INVESTORS_ONLY);
    },
    async cancelOrder() {
      throw new Error(INVESTORS_ONLY);
    },
    async setPublicRanking() {
      throw new Error(INVESTORS_ONLY);
    },
    async publicRanking() {
      return [];
    },
    async openSession() {
      throw new Error(INVESTORS_ONLY);
    },
    async closeSession() {
      throw new Error(INVESTORS_ONLY);
    },
    async marketOffers() {
      return [];
    },
    async shareIssues() {
      return [];
    },
    async createOffer() {
      throw new Error(INVESTORS_ONLY);
    },
    async cancelOffer() {
      throw new Error(INVESTORS_ONLY);
    },
    async subscribe() {
      throw new Error(INVESTORS_ONLY);
    },
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
