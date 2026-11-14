import { useEffect, useState, type FormEvent } from "react";
import { ImperialDate } from "../../components/figures.tsx";
import { useData } from "../../data/DataProvider.tsx";
import type { ApiKey, CreatedApiKey } from "../../data/source.ts";
import { parisClock, parisDay } from "./format.ts";

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

function When({ timestamp }: { timestamp: string }) {
  return (
    <>
      <ImperialDate date={parisDay(timestamp)} /> à {parisClock(timestamp)}
    </>
  );
}

function KeyRow({ apiKey, onRevoked }: { apiKey: ApiKey; onRevoked: () => void }) {
  const { source } = useData();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revoked = apiKey.revokedAt !== null;

  const revoke = async () => {
    setBusy(true);
    setError(null);
    try {
      await source.revokeApiKey(apiKey.id);
      onRevoked();
    } catch (reason) {
      setError(messageOf(reason));
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <li className={revoked ? "keys__item is-revoked" : "keys__item"}>
      <div className="keys__name">
        <strong>{apiKey.name}</strong>
        <code>{apiKey.prefix}…</code>
      </div>
      <p>
        {revoked && apiKey.revokedAt ? (
          <>
            Révoquée le <When timestamp={apiKey.revokedAt} />
          </>
        ) : apiKey.lastUsedAt ? (
          <>
            Dernier usage le <When timestamp={apiKey.lastUsedAt} />
          </>
        ) : (
          "Jamais utilisée"
        )}
      </p>
      {revoked ? null : confirming ? (
        <p className="keys__actions">
          <button type="button" className="linklike keys__danger" disabled={busy} onClick={revoke}>
            {busy ? "révocation…" : "confirmer la révocation"}
          </button>
          <button
            type="button"
            className="linklike"
            disabled={busy}
            onClick={() => setConfirming(false)}
          >
            annuler
          </button>
        </p>
      ) : (
        <p className="keys__actions">
          <button type="button" className="linklike" onClick={() => setConfirming(true)}>
            révoquer
          </button>
        </p>
      )}
      {error ? (
        <p className="note note--error" role="alert">
          Révocation refusée : {error}
        </p>
      ) : null}
    </li>
  );
}

function NewSecret({ created, onDone }: { created: CreatedApiKey; onDone: () => void }) {
  const [copied, setCopied] = useState<"idle" | "ok" | "failed">("idle");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(created.secret);
      setCopied("ok");
    } catch {
      setCopied("failed");
    }
  };

  return (
    <div className="note note--ok keys__secret" role="status">
      <strong>Clé « {created.key.name} » créée.</strong>
      <code>{created.secret}</code>
      <p>
        Copiez-la maintenant dans le module : KNX n'en garde qu'une empreinte et ne pourra plus
        l'afficher.
      </p>
      <p className="keys__actions">
        <button type="button" className="button button--quiet" onClick={copy}>
          {copied === "ok" ? "Copiée" : "Copier la clé"}
        </button>
        <button type="button" className="linklike" onClick={onDone}>
          c'est fait
        </button>
      </p>
      {copied === "failed" ? <p>Copie impossible ici : sélectionnez la clé à la main.</p> : null}
    </div>
  );
}

/** Keys of the in-game module: create (shown once), see last use, revoke. */
export function ApiKeysPanel() {
  const { source } = useData();
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedApiKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    source.apiKeys().then(
      (items) => {
        if (cancelled) return;
        setKeys(items);
        setLoadError(null);
      },
      (reason: unknown) => {
        if (!cancelled) setLoadError(messageOf(reason));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [source, version]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setCreateError(null);
    try {
      setCreated(await source.createApiKey(name.trim()));
      setName("");
      setVersion((v) => v + 1);
    } catch (reason) {
      setCreateError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  };

  const active = keys?.filter((k) => k.revokedAt === null).length ?? 0;

  return (
    <section className="keys" aria-labelledby="keys">
      <div className="section-head">
        <h2 id="keys">Clés du module de jeu</h2>
        <p>
          {keys === null
            ? "Chargement…"
            : `${active} clé${active > 1 ? "s" : ""} active${active > 1 ? "s" : ""}`}
        </p>
      </div>
      <p className="keys__intro">
        Le module installé dans le navigateur d'un joueur envoie le relevé du jour avec une de ces
        clés. Ses envois attendent votre validation.
      </p>

      {created ? <NewSecret created={created} onDone={() => setCreated(null)} /> : null}

      <form className="keys__form" onSubmit={create}>
        <label className="field">
          <span className="label">Nom de la nouvelle clé</span>
          <input
            value={name}
            maxLength={60}
            required
            placeholder="Module de l'opérateur"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button className="button button--quiet" type="submit" disabled={busy || !name.trim()}>
          {busy ? "Création…" : "Créer une clé"}
        </button>
      </form>
      {createError ? (
        <p className="note note--error" role="alert">
          Création refusée : {createError}
        </p>
      ) : null}

      {loadError ? (
        <p className="note note--error" role="alert">
          Clés illisibles : {loadError}
        </p>
      ) : keys && keys.length > 0 ? (
        <ul className="keys__list">
          {keys.map((k) => (
            <KeyRow key={k.id} apiKey={k} onRevoked={() => setVersion((v) => v + 1)} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
