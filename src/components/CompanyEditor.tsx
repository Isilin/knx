import { useEffect, useId, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { useData } from "../data/DataProvider.tsx";
import { formatImperialDate } from "../domain/imperial.ts";
import type { CompanySeries } from "../domain/market.ts";
import { isSectorId, SECTORS, type SectorId } from "../domain/sectors.ts";
import type { Consortium } from "../domain/types.ts";
import { toLogoBlob } from "../lib/image.ts";
import "./CompanyEditor.css";

type LogoChange =
  | { kind: "keep" }
  | { kind: "set"; blob: Blob; preview: string }
  | { kind: "remove" };

interface CompanyEditorProps {
  company: CompanySeries;
  consortiums: readonly Consortium[];
  onClose: () => void;
}

/** The operator's form for what the game does not publish: logo, consortium, sector, founding. */
export function CompanyEditor({ company, consortiums, onClose }: CompanyEditorProps) {
  const { change } = useData();
  const id = useId();
  const [consortiumId, setConsortiumId] = useState(company.consortium?.id ?? "");
  const [sector, setSector] = useState<SectorId | "">(company.sector ?? "");
  const [founded, setFounded] = useState(
    company.creation?.method === "manual" ? company.creation.creation : "",
  );
  const [logo, setLogo] = useState<LogoChange>({ kind: "keep" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (logo.kind === "set") URL.revokeObjectURL(logo.preview);
    },
    [logo],
  );

  const estimate =
    company.creation && company.creation.method === "bounds"
      ? `vers le ${formatImperialDate(company.creation.creation)}`
      : null;
  const shown =
    logo.kind === "set" ? logo.preview : logo.kind === "remove" ? null : company.logoUrl;

  const pickLogo = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const blob = await toLogoBlob(file);
      setLogo({ kind: "set", blob, preview: URL.createObjectURL(blob) });
    } catch (e) {
      setError(`Logo refusé : ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await change(async (source) => {
        await source.updateCompany(company.id, {
          consortiumId: consortiumId || null,
          sector: sector || null,
          creationOverride: founded || null,
        });
        if (logo.kind === "set") await source.setLogo(company.id, logo.blob);
        if (logo.kind === "remove") await source.setLogo(company.id, null);
      });
      onClose();
    } catch (e) {
      setError(`Enregistrement refusé : ${e instanceof Error ? e.message : String(e)}`);
      setBusy(false);
    }
  };

  return (
    <form className="profile-editor" onSubmit={submit} aria-labelledby={`${id}-title`}>
      <div className="section-head">
        <h2 id={`${id}-title`}>Modifier la fiche</h2>
        <p>Informations saisies par KNX, absentes du rapport du jeu.</p>
      </div>

      <div className="profile-editor__grid">
        <div className="field">
          <span className="label">Logo</span>
          <div className="profile-editor__logo">
            <span className="logo-frame">
              {shown ? (
                <img src={shown} alt="" width={72} height={72} />
              ) : (
                <span className="logo-frame__empty">aucun</span>
              )}
            </span>
            <span className="profile-editor__logo-actions">
              <label className="button button--quiet">
                {company.logoUrl || logo.kind === "set" ? "Remplacer" : "Ajouter une image"}
                <input
                  className="sr-only"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(e) => {
                    void pickLogo(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              {shown ? (
                <button
                  type="button"
                  className="linklike"
                  onClick={() => setLogo(company.logoUrl ? { kind: "remove" } : { kind: "keep" })}
                >
                  Retirer le logo
                </button>
              ) : null}
            </span>
          </div>
          <small className="profile-editor__hint">
            PNG, JPEG, WebP ou SVG. Réduit à 256 px. Le sceau reste la signature de la fiche.
          </small>
        </div>

        <label className="field">
          <span className="label">Consortium</span>
          <select value={consortiumId} onChange={(e) => setConsortiumId(e.target.value)}>
            <option value="">Indépendante</option>
            {consortiums.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
          <small className="profile-editor__hint">
            <Link to="/releves#consortiums">Gérer la liste des consortiums</Link>
          </small>
        </label>

        <label className="field">
          <span className="label">Secteur d'activité</span>
          <select
            value={sector}
            onChange={(e) => setSector(isSectorId(e.target.value) ? e.target.value : "")}
          >
            <option value="">Non renseigné</option>
            {SECTORS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="label">Date de fondation</span>
          <input
            type="date"
            value={founded}
            max={company.firstSeen}
            onChange={(e) => setFounded(e.target.value)}
          />
          <small className="profile-editor__hint">
            {founded
              ? "Remplace l'estimation de KNX dans le calcul de l'âge et du CA réel."
              : estimate
                ? `Vide : KNX l'estime ${estimate}.`
                : "Vide : KNX l'estime d'après l'historique."}
          </small>
        </label>
      </div>

      {error ? (
        <p className="note note--error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="profile-editor__actions">
        <button type="submit" className="button" disabled={busy}>
          {busy ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button type="button" className="button button--quiet" onClick={onClose} disabled={busy}>
          Annuler
        </button>
      </div>
    </form>
  );
}
