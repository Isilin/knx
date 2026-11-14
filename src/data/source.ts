import type { ResolvedRows } from "../domain/identity.ts";
import type { CompanyPatch, ConsortiumDraft, EventDraft } from "../domain/mutations.ts";
import type {
  Dataset,
  IsoDate,
  PublishRequest,
  ReportRow,
  SnapshotSource,
} from "../domain/types.ts";

export type { CompanyPatch, ConsortiumDraft, EventDraft, PublishRequest, ResolvedRows };

export type Session =
  | { state: "anonymous" }
  | { state: "signed-in"; email: string; isAdmin: boolean };

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
  /** Consortium, sector, typed creation date. */
  updateCompany(id: string, patch: CompanyPatch): Promise<void>;
  /** Sets (already reduced to a small WebP) or removes a corporation's logo. */
  setLogo(id: string, logo: Blob | null): Promise<void>;
  saveConsortium(draft: ConsortiumDraft): Promise<void>;
  deleteConsortium(id: string): Promise<void>;
  saveEvent(draft: EventDraft): Promise<void>;
  deleteEvent(id: string): Promise<void>;
  session(): Promise<Session>;
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
