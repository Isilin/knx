import type { CompanyPatch, ConsortiumDraft, EventDraft } from "../domain/mutations.ts";
import type { Dataset, PublishRequest } from "../domain/types.ts";

export type { CompanyPatch, ConsortiumDraft, EventDraft, PublishRequest };

export type Session =
  | { state: "anonymous" }
  | { state: "signed-in"; email: string; isAdmin: boolean };

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
}
