import type { Dataset } from "../src/domain/types.ts";

function text(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function nullable(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "null";
  return typeof value === "number" ? String(value) : text(value);
}

function textArray(values: readonly string[]): string {
  return values.length === 0 ? "'{}'::text[]" : `array[${values.map(text).join(", ")}]`;
}

/**
 * Renders the dataset as a Supabase seed (run after the migrations). It replaces the whole
 * registry: run it once, on a fresh base, before any edit made through the site.
 */
export function toSeedSql(dataset: Dataset): string {
  const out: string[] = [
    "-- Généré par scripts/import-sheet.ts ; ne pas modifier à la main.",
    "begin;",
    "truncate public.company_events, public.snapshot_rows, public.snapshots, public.companies, public.consortiums restart identity cascade;",
    "",
  ];

  if (dataset.consortiums.length > 0) {
    out.push(
      "insert into public.consortiums (id, name, color) overriding system value values",
      dataset.consortiums
        .map((k) => `  (${Number(k.id)}, ${text(k.name)}, ${text(k.color)})`)
        .join(",\n") + ";",
      "select setval(pg_get_serial_sequence('public.consortiums', 'id'), (select max(id) from public.consortiums));",
      "",
    );
  }

  out.push(
    "insert into public.companies (id, name, aliases, consortium_id, sector, creation_override, closed_on) overriding system value values",
    dataset.companies
      .map(
        (c) =>
          `  (${Number(c.id)}, ${text(c.name)}, ${textArray(c.formerNames)}, ${nullable(c.consortiumId === null ? null : Number(c.consortiumId))}, ${nullable(c.sector)}, ${nullable(c.creationOverride)}, ${nullable(c.closedOn)})`,
      )
      .join(",\n") + ";",
    "select setval(pg_get_serial_sequence('public.companies', 'id'), (select max(id) from public.companies));",
    "",
  );

  for (const snapshot of dataset.snapshots) {
    out.push(
      `insert into public.snapshots (taken_on, source) values (${text(snapshot.date)}, ${text(snapshot.source)});`,
    );
    if (snapshot.rows.length === 0) continue;
    const values = snapshot.rows
      .map(
        (r) =>
          `  (${Number(r.companyId)}, ${nullable(r.rank)}, ${r.chiffre}, ${nullable(r.capital)}, ${nullable(r.employees)})`,
      )
      .join(",\n");
    out.push(
      "insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)",
      `select s.id, v.company_id::bigint, v.rank::integer, v.chiffre::bigint, v.capital::bigint, v.employees::integer from (values\n${values}\n) as v(company_id, rank, chiffre, capital, employees)`,
      `join public.snapshots s on s.taken_on = ${text(snapshot.date)};`,
      "",
    );
  }

  out.push("commit;", "");
  return out.join("\n");
}
