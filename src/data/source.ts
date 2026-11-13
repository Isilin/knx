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

export interface DataSource {
  readonly kind: "local" | "supabase";
  load(): Promise<Dataset>;
  publish(request: PublishRequest): Promise<void>;
  session(): Promise<Session>;
  /** Sends a sign-in link; resolves once the email is on its way. */
  requestSignIn(email: string): Promise<void>;
  signOut(): Promise<void>;
  onSessionChange(listener: () => void): () => void;
}
