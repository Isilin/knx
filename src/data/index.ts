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
    withdrawSnapshot: async (date) => (await get()).withdrawSnapshot(date),
    updateCompany: async (id, patch) => (await get()).updateCompany(id, patch),
    updateProfile: async (id, patch) => (await get()).updateProfile(id, patch),
    setMemberships: async (id, periods) => (await get()).setMemberships(id, periods),
    setLogo: async (id, logo) => (await get()).setLogo(id, logo),
    saveConsortium: async (draft) => (await get()).saveConsortium(draft),
    deleteConsortium: async (id) => (await get()).deleteConsortium(id),
    saveEvent: async (draft) => (await get()).saveEvent(draft),
    deleteEvent: async (id) => (await get()).deleteEvent(id),
    saveMarketEvent: async (draft) => (await get()).saveMarketEvent(draft),
    deleteMarketEvent: async (id) => (await get()).deleteMarketEvent(id),
    publishRating: async (draft) => (await get()).publishRating(draft),
    deleteRating: async (id) => (await get()).deleteRating(id),
    publishValuationSettings: async (draft) => (await get()).publishValuationSettings(draft),
    saveSecurityOperation: async (draft) => (await get()).saveSecurityOperation(draft),
    deleteSecurityOperation: async (id) => (await get()).deleteSecurityOperation(id),
    saveBalanceSheet: async (draft) => (await get()).saveBalanceSheet(draft),
    deleteBalanceSheet: async (id) => (await get()).deleteBalanceSheet(id),
    session: async () => (await get()).session(),
    signInInvestor: async (login, password) => (await get()).signInInvestor(login, password),
    changePassword: async (password) => (await get()).changePassword(password),
    cashMovements: async () => (await get()).cashMovements(),
    requestWithdrawal: async (amount, note) => (await get()).requestWithdrawal(amount, note),
    cancelWithdrawal: async (id) => (await get()).cancelWithdrawal(id),
    investorAccounts: async () => (await get()).investorAccounts(),
    createInvestorAccount: async (draft) => (await get()).createInvestorAccount(draft),
    resetInvestorPassword: async (login, password) =>
      (await get()).resetInvestorPassword(login, password),
    recordDeposit: async (id, amount, note) => (await get()).recordDeposit(id, amount, note),
    settleWithdrawal: async (id) => (await get()).settleWithdrawal(id),
    setInsiders: async (id, profiles) => (await get()).setInsiders(id, profiles),
    marketSessions: async () => (await get()).marketSessions(),
    marketOrders: async () => (await get()).marketOrders(),
    marketTrades: async () => (await get()).marketTrades(),
    placeOrder: async (draft) => (await get()).placeOrder(draft),
    cancelOrder: async (id) => (await get()).cancelOrder(id),
    setPublicRanking: async (value) => (await get()).setPublicRanking(value),
    publicRanking: async () => (await get()).publicRanking(),
    openSession: async (date) => (await get()).openSession(date),
    closeSession: async (id, report, references, params) =>
      (await get()).closeSession(id, report, references, params),
    marketOffers: async () => (await get()).marketOffers(),
    shareIssues: async () => (await get()).shareIssues(),
    createOffer: async (draft) => (await get()).createOffer(draft),
    cancelOffer: async (id) => (await get()).cancelOffer(id),
    subscribe: async (offer, quantity) => (await get()).subscribe(offer, quantity),
    dividendPolicies: async () => (await get()).dividendPolicies(),
    saveDividendPolicy: async (draft) => (await get()).saveDividendPolicy(draft),
    deleteDividendPolicy: async (id) => (await get()).deleteDividendPolicy(id),
    dividends: async () => (await get()).dividends(),
    dividendPayments: async () => (await get()).dividendPayments(),
    declareDividend: async (draft) => (await get()).declareDividend(draft),
    cancelDividend: async (id, reason) => (await get()).cancelDividend(id, reason),
    requestSignIn: async (email) => (await get()).requestSignIn(email),
    signInWithPassword: async (email, password) =>
      (await get()).signInWithPassword(email, password),
    signOut: async () => (await get()).signOut(),
    pending: async () => (await get()).pending(),
    publishPending: async (id, resolved) => (await get()).publishPending(id, resolved),
    rejectPending: async (id) => (await get()).rejectPending(id),
    apiKeys: async () => (await get()).apiKeys(),
    createApiKey: async (name) => (await get()).createApiKey(name),
    revokeApiKey: async (id) => (await get()).revokeApiKey(id),
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
  ApiKey,
  CompanyPatch,
  ConsortiumDraft,
  CreatedApiKey,
  DataSource,
  EventDraft,
  MarketEventDraft,
  PendingSnapshot,
  RatingDraft,
  PublishRequest,
  Session,
} from "./source.ts";
