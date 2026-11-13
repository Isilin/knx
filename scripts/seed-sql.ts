import type { Dataset } from "../src/domain/types.ts";

function text(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function nullable(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "null";
  return typeof value === "number" ? String(value) : text(value);
}

/** Renders the dataset as an idempotent Supabase seed (run after the migrations). */
export function toSeedSql(dataset: Dataset): string {
  const out: string[] = [
    "-- Généré par scripts/import-sheet.ts ; ne pas modifier à la main.",
    "begin;",
    "truncate public.snapshot_rows, public.snapshots, public.companies restart identity cascade;",
    "",
    "insert into public.companies (name, creation_override) values",
    dataset.companies
      .map(
        (c) => `  (${text(c.name)}, ${nullable(c.creationOverride ? c.creationOverride : null)})`,
      )
      .join(",\n") + ";",
    "",
  ];

  for (const snapshot of dataset.snapshots) {
    out.push(
      `insert into public.snapshots (taken_on, source) values (${text(snapshot.date)}, ${text(snapshot.source)});`,
    );
    if (snapshot.rows.length === 0) continue;
    const values = snapshot.rows
      .map(
        (r) =>
          `  (${text(r.name)}, ${nullable(r.rank)}, ${r.chiffre}, ${nullable(r.capital)}, ${nullable(r.employees)})`,
      )
      .join(",\n");
    out.push(
      "insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)",
      `select s.id, c.id, v.rank::integer, v.chiffre::bigint, v.capital::bigint, v.employees::integer from (values\n${values}\n) as v(name, rank, chiffre, capital, employees)`,
      `join public.companies c on c.name = v.name join public.snapshots s on s.taken_on = ${text(snapshot.date)};`,
      "",
    );
  }

  out.push("commit;", "");
  return out.join("\n");
}
