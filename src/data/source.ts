import type { ResolvedRows } from "../domain/identity.ts";
import type { CashMovement, InvestorAccount } from "../domain/investors.ts";
import type {
  MarketOrder,
  MarketSession,
  MarketTrade,
  OrderSide,
  RankingEntry,
  SessionPrice,
} from "../domain/trading.ts";
import type { MembershipDraft } from "../domain/memberships.ts";
import type {
  BalanceSheetDraft,
  CompanyPatch,
  ConsortiumDraft,
  EventDraft,
  MarketEventDraft,
  ProfilePatch,
  RatingDraft,
  SecurityOperationDraft,
  ValuationSettingsDraft,
} from "../domain/mutations.ts";
import type {
  Dataset,
  IsoDate,
  PublishRequest,
  ReportRow,
  SnapshotSource,
} from "../domain/types.ts";

export type {
  BalanceSheetDraft,
  CompanyPatch,
  ConsortiumDraft,
  EventDraft,
  MarketEventDraft,
  MembershipDraft,
  ProfilePatch,
  PublishRequest,
  RatingDraft,
  ResolvedRows,
  SecurityOperationDraft,
  ValuationSettingsDraft,
};

export type Session =
  | { state: "anonymous" }
  | {
      state: "signed-in";
      email: string;
      isAdmin: boolean;
      /** The player's investor account, when the session is a player's. */
      investor: InvestorAccount | null;
    };

/** A report sent by the in-game module, waiting for an operator to publish or reject it. */
export interface PendingSnapshot {
  id: number;
  date: IsoDate;
  source: SnapshotSource;
  /** When the module sent it (ISO timestamp). */
  receivedAt: string;
  /** The module key that sent it; null for a pending report typed by hand. */
  key: { name: string; prefix: string; revoked: boolean } | null;
  /** Rows as sent, by name: who is who is settled at review time. */
  rows: ReportRow[];
}

/** A module key, as the admin screen lists it. The key itself is never stored. */
export interface ApiKey {
  id: number;
  name: string;
  /** First characters of the key (`knx_3f9a1c2e`), to recognise it. */
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface CreatedApiKey {
  key: ApiKey;
  /** The full key, shown once: KNX keeps only its fingerprint. */
  secret: string;
}

export interface DataSource {
  readonly kind: "local" | "supabase";
  load(): Promise<Dataset>;
  publish(request: PublishRequest): Promise<void>;
  /** Withdraws the latest published report and undoes what its publication did. */
  withdrawSnapshot(date: IsoDate): Promise<void>;
  /** Typed creation date of one life. */
  updateCompany(id: string, patch: CompanyPatch): Promise<void>;
  /** Sector, district, hidden flag of a page: shared by all its lives. */
  updateProfile(id: string, patch: ProfilePatch): Promise<void>;
  /** Replaces every dated consortium membership of a page, in one go. */
  setMemberships(profileId: string, periods: MembershipDraft[]): Promise<void>;
  /** Sets (already reduced to a small WebP) or removes a page's logo. */
  setLogo(profileId: string, logo: Blob | null): Promise<void>;
  saveConsortium(draft: ConsortiumDraft): Promise<void>;
  deleteConsortium(id: string): Promise<void>;
  saveEvent(draft: EventDraft): Promise<void>;
  deleteEvent(id: string): Promise<void>;
  /** Events of the whole market (game rules, breaches). */
  saveMarketEvent(draft: MarketEventDraft): Promise<void>;
  deleteMarketEvent(id: string): Promise<void>;
  /** Publishes a rating of the Agence impériale de notation; a rating is never edited. */
  publishRating(draft: RatingDraft): Promise<void>;
  /** Withdraws a published rating. */
  deleteRating(id: string): Promise<void>;
  /** Publishes a new version of the theoretical value's settings; it takes effect at once. */
  publishValuationSettings(draft: ValuationSettingsDraft): Promise<void>;
  /** Records an operation on securities, already checked with `planOperation`. */
  saveSecurityOperation(draft: SecurityOperationDraft): Promise<void>;
  deleteSecurityOperation(id: string): Promise<void>;
  /** Records a balance sheet, already checked with `planBalance`. */
  saveBalanceSheet(draft: BalanceSheetDraft): Promise<void>;
  deleteBalanceSheet(id: string): Promise<void>;
  session(): Promise<Session>;
  /** Signs a player in with their five-digit login. */
  signInInvestor(login: string, password: string): Promise<void>;
  /** Replaces the signed-in player's password, and lifts the temporary-password flag. */
  changePassword(password: string): Promise<void>;
  /** The signed-in player's movements; every account's for an operator. */
  cashMovements(): Promise<CashMovement[]>;
  requestWithdrawal(amount: number, note: string | null): Promise<void>;
  /** A player withdraws their request; an operator refuses one. */
  cancelWithdrawal(id: string): Promise<void>;
  /** Every investor account (operators only). */
  investorAccounts(): Promise<InvestorAccount[]>;
  createInvestorAccount(draft: {
    login: string;
    displayName: string;
    password: string;
  }): Promise<void>;
  resetInvestorPassword(login: string, password: string): Promise<void>;
  recordDeposit(accountId: string, amount: number, note: string | null): Promise<void>;
  /** The withdrawal was paid in the game. */
  settleWithdrawal(id: string): Promise<void>;
  /** Pages an account is declared an insider of (operators only). */
  setInsiders(accountId: string, profileIds: string[]): Promise<void>;
  /** Market sessions, the latest first (public). */
  marketSessions(): Promise<MarketSession[]>;
  /** The signed-in player's orders and trades; every account's for an operator. */
  marketOrders(): Promise<MarketOrder[]>;
  marketTrades(): Promise<MarketTrade[]>;
  placeOrder(draft: {
    companyId: string;
    side: OrderSide;
    quantity: number;
    limit: number;
    /** Sessions the order lives, 1–4. */
    sessions: number;
  }): Promise<void>;
  /** The signed-in player appears in the public ranking, or leaves it. */
  setPublicRanking(value: boolean): Promise<void>;
  /** Investors who chose to be ranked (public). */
  publicRanking(): Promise<RankingEntry[]>;
  cancelOrder(id: string): Promise<void>;
  /** Opens the first session (each close opens the next). */
  openSession(date: string): Promise<void>;
  /** Fills the session's orders at the prices fixed, then opens the next session. */
  closeSession(
    sessionId: string,
    reportDate: string,
    prices: SessionPrice[],
    params: Record<string, number>,
  ): Promise<void>;
  /** Sends a sign-in link; resolves once the email is on its way. */
  requestSignIn(email: string): Promise<void>;
  /** Signs in with an operator password; resolves once the session exists. */
  signInWithPassword(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  onSessionChange(listener: () => void): () => void;
  /** Reports sent by the in-game module and not yet reviewed (operators only). */
  pending(): Promise<PendingSnapshot[]>;
  /** Publishes a pending report with the operator's identity decisions. */
  publishPending(id: number, resolved: ResolvedRows): Promise<void>;
  rejectPending(id: number): Promise<void>;
  apiKeys(): Promise<ApiKey[]>;
  createApiKey(name: string): Promise<CreatedApiKey>;
  revokeApiKey(id: number): Promise<void>;
}
