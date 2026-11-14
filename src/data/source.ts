import type { Dataset, IsoDate, SnapshotRow, SnapshotSource } from "../domain/types.ts";

export interface PublishRequest {
  date: IsoDate;
  source: SnapshotSource;
  rows: SnapshotRow[];
  /** Replace an existing report for the same date. */
  replace: boolean;
}

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
  rows: SnapshotRow[];
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
  session(): Promise<Session>;
  /** Sends a sign-in link; resolves once the email is on its way. */
  requestSignIn(email: string): Promise<void>;
  /** Signs in with an operator password; resolves once the session exists. */
  signInWithPassword(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  onSessionChange(listener: () => void): () => void;
  /** Reports sent by the in-game module and not yet reviewed (operators only). */
  pending(): Promise<PendingSnapshot[]>;
  publishPending(id: number): Promise<void>;
  rejectPending(id: number): Promise<void>;
  apiKeys(): Promise<ApiKey[]>;
  createApiKey(name: string): Promise<CreatedApiKey>;
  revokeApiKey(id: number): Promise<void>;
}
