import type { IsoDate, RowFigures } from "../src/domain/types.ts";
import { nullable, text, textArray } from "./seed-sql.ts";

/** A life recovered from the sheet's version history: closed, every report from a removed column. */
export interface RecoveredLife {
  name: string;
  /** Names it carried before, oldest first (renamed columns). */
  formerNames: string[];
  closedOn: IsoDate;
  creationOverride: IsoDate | null;
  rows: (Omit<RowFigures, "rank"> & { date: IsoDate })[];
}

/**
 * Renders the recovered lives as one SQL block for a base already filled from the site (the seed
 * would replace the whole registry and lose what was edited there). Each life joins the page of
 * the latest life with its name, or a new page whose consortium is guessed from the name's first
 * word; its reports go into the published reports of the same dates. All or nothing: it refuses
 * to run twice, and stops if the page already has a report within the life's dates. `aliases`
 * adds former names, found in renamed columns, to open corporations of the base.
 */
export function toBackfillSql(
  lives: readonly RecoveredLife[],
  aliases: readonly { name: string; formerNames: readonly string[] }[] = [],
): string {
  const out: string[] = [
    "-- Généré par scripts/import-sheet.ts (--backfill) ; ne pas modifier à la main.",
    "-- Corporations détruites dont les colonnes avaient été supprimées du tableur, retrouvées dans",
    "-- son historique des versions. À exécuter une fois, après 20261118000000_fiches_vies.sql, sur",
    "-- une base déjà remplie. Tout ou rien : une erreur annule l'ensemble.",
    "do $$",
    "declare",
    "  v_profile bigint;",
    "  v_company bigint;",
    "  v_count integer;",
    "begin",
  ];

  for (const life of lives) {
    const first = life.rows[0]?.date;
    const last = life.rows.at(-1)?.date;
    if (!first || !last) continue;
    const name = text(life.name);
    const values = life.rows
      .map(
        (r) =>
          `    (${text(r.date)}::date, ${r.chiffre}::bigint, ${nullable(r.capital)}::bigint, ${nullable(r.employees)}::integer)`,
      )
      .join(",\n");
    out.push(
      "",
      `  -- ${life.name} : ${life.rows.length} relevés du ${first} au ${last}, fermée le ${life.closedOn}.`,
      `  if exists (select 1 from public.companies where name = ${name} and closed_on = ${text(life.closedOn)}) then`,
      `    raise exception 'déjà appliqué : « % » fermée le % existe', ${name}, ${text(life.closedOn)};`,
      "  end if;",
      "  v_profile := null;",
      "  select c.profile_id into v_profile from public.companies c",
      `  where c.name = ${name} order by c.closed_on desc nulls first, c.id desc limit 1;`,
      "  if v_profile is null then",
      "    insert into public.company_profiles (consortium_id)",
      "    values ((select k.id from public.consortiums k",
      `             where ${name} like k.name || ' %' order by length(k.name) desc limit 1))`,
      "    returning id into v_profile;",
      "  elsif exists (",
      "    select 1 from public.snapshot_rows sr",
      "    join public.snapshots s on s.id = sr.snapshot_id",
      "    join public.companies c on c.id = sr.company_id",
      `    where c.profile_id = v_profile and s.taken_on between ${text(first)} and ${text(last)}`,
      "  ) then",
      `    raise exception 'la fiche de « % » a déjà un relevé entre le % et le %', ${name}, ${text(first)}, ${text(last)};`,
      "  end if;",
      "  insert into public.companies (name, aliases, profile_id, closed_on, creation_override)",
      `  values (${name}, ${textArray(life.formerNames)}, v_profile, ${text(life.closedOn)}, ${life.creationOverride ? text(life.creationOverride) : "null"})`,
      "  returning id into v_company;",
      "  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)",
      "  select s.id, v_company, null, v.chiffre, v.capital, v.employees",
      "  from (values",
      values,
      "  ) as v(taken_on, chiffre, capital, employees)",
      "  join public.snapshots s on s.taken_on = v.taken_on;",
      "  get diagnostics v_count = row_count;",
      `  if v_count <> ${life.rows.length} then`,
      `    raise exception '« % » : % relevés trouvés sur ${life.rows.length}', ${name}, v_count;`,
      "  end if;",
    );
  }

  if (aliases.length > 0) out.push("", "  -- Anciens noms retrouvés dans les colonnes renommées.");
  for (const { name, formerNames } of aliases)
    for (const former of formerNames)
      out.push(
        `  update public.companies set aliases = array_append(aliases, ${text(former)})`,
        `  where name = ${text(name)} and closed_on is null and not (${text(former)} = any(aliases));`,
      );

  out.push("end;", "$$;", "");
  return out.join("\n");
}

/** A rename event, with the life it belongs to as the base knows it: its name and closure. */
export interface RenameEventRow {
  name: string;
  closedOn: IsoDate | null;
  date: IsoDate;
  details: { from?: string; to?: string };
  note: string | null;
}

/**
 * Renders rename events found in the sheet's history as SQL for a filled base: each joins the life
 * of that name and closure. Safe to run twice (an event already there is skipped); stops if a life
 * is missing.
 */
export function toRenameEventsSql(events: readonly RenameEventRow[]): string {
  const out: string[] = [
    "-- Généré par scripts/import-sheet.ts (--renames) ; ne pas modifier à la main.",
    "-- Changements de nom relevés dans l'historique des versions du tableur, datés du moment où",
    "-- l'en-tête de la colonne a changé. Sans effet s'ils sont déjà enregistrés.",
    "do $$",
    "begin",
  ];
  for (const e of events) {
    const from = text(e.details.from ?? "");
    const to = text(e.details.to ?? "");
    const life = `c.name = ${text(e.name)} and c.closed_on is not distinct from ${e.closedOn ? `${text(e.closedOn)}::date` : "null"}`;
    out.push(
      "",
      `  -- ${e.details.from} → ${e.details.to} (${e.name}), ${e.date}.`,
      `  if not exists (select 1 from public.companies c where ${life}) then`,
      `    raise exception 'corporation introuvable : « % »', ${text(e.name)};`,
      "  end if;",
      "  insert into public.company_events (company_id, occurred_on, kind, details, note, origin)",
      `  select c.id, ${text(e.date)}, 'renamed', jsonb_build_object('from', ${from}, 'to', ${to}), ${e.note ? text(e.note) : "null"}, 'auto'`,
      "  from public.companies c",
      `  where ${life}`,
      "    and not exists (",
      "      select 1 from public.company_events x",
      `      where x.company_id = c.id and x.kind = 'renamed' and x.details->>'from' = ${from} and x.details->>'to' = ${to}`,
      "    );",
    );
  }
  out.push("end;", "$$;", "");
  return out.join("\n");
}
