/**
 * Imports the historical Google Sheet export into KNX's dataset format.
 *
 *   node scripts/import-sheet.ts "data/source/Données entreprises.xlsx" \
 *     --report "data/source/releves/2026-11-13.txt=2026-11-13" \
 *     --versions data/source/versions \
 *     --backfill supabase/backfill/20261117_corporations_detruites.sql \
 *     --renames supabase/backfill/20261118_renommages.sql
 *
 * Writes `public/data/history.json` (local data source) and `supabase/seed.sql`.
 * Reads values only (formula results); the sheet's formulas are re-implemented in `src/domain`.
 *
 * `--versions`: a folder of past versions of the sheet (`.xlsx`, exported by
 * `scripts/sheet-versions.gs`). The columns of destroyed corporations, deleted from the sheet, are
 * recovered from them, and renamed columns become former names and dated rename events.
 * `--renames`: writes the SQL that adds those rename events to a filled Supabase base.
 * `--backfill`: also writes the SQL that adds those recovered corporations to
 * a Supabase base already filled (the seed would replace it whole).
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { isIsoDate } from "../src/domain/dates.ts";
import { isRefounding } from "../src/domain/identity.ts";
import { inferGroups } from "../src/domain/market.ts";
import { parseReport } from "../src/domain/report.ts";
import { formatImperialDate } from "../src/domain/imperial.ts";
import type {
  CompanyEvent,
  CompanyMeta,
  CompanyProfile,
  Consortium,
  ConsortiumColor,
  Dataset,
  IsoDate,
  MarketEvent,
  ReportRow,
  Snapshot,
  SnapshotSource,
} from "../src/domain/types.ts";
import { toBackfillSql, toRenameEventsSql, type RecoveredLife } from "./backfill-sql.ts";
import {
  columnTrack,
  mergeTracks,
  removedColumns,
  typedCreations,
  withoutRenamedColumns,
  formerNamesOf,
  renameHops,
  type RenamedColumn,
  type MergedRow,
  type SheetData,
  type SheetVersion,
} from "./sheet-merge.ts";
import { readWorkbook } from "./sheet-workbook.ts";
import { toSeedSql } from "./seed-sql.ts";

/**
 * Market events of the local data source. On Supabase they live in `market_events`, created by
 * the migration 20261115000000_evenements_marche.sql; the seed leaves that table alone.
 */
const MARKET_EVENTS: MarketEvent[] = [
  {
    id: "1",
    date: "2026-03-23",
    label: "ZD-385",
    title: "Faille ZD-385",
    description:
      "Une vulnérabilité zero-day dans les terminaux de trésorerie des corporations expose tout capital supérieur à 30 M¢ au piratage. En une heptade, la plupart des directions générales ramènent leurs coffres sous le seuil : les sorties de capital de cette période sont des mises à l'abri, pas des pertes.",
    span: 7,
  },
];

/**
 * Corporations kept out of KNX's displays: run by the game masters for their own building
 * needs, not real businesses. The reports still list them. On Supabase, the flag is
 * `company_profiles.hidden` (migration 20261118000000_fiches_vies.sql).
 */
const HIDDEN_COMPANIES = new Set(["MJ Immo"]);

/**
 * A corporation refounded under the same name is most often the same house: its new life joins
 * the page of the former one. List here a namesake that has nothing to do with its predecessor,
 * with the date of its first report: it gets a page of its own.
 */
const SEPARATE_NAMESAKES = new Map<string, IsoDate[]>([]);

function parseArgs(argv: string[]): {
  workbook: string;
  reports: { path: string; date: string }[];
  versions: string | null;
  backfill: string | null;
  renames: string | null;
} {
  const reports: { path: string; date: string }[] = [];
  let workbook = "data/source/Données entreprises.xlsx";
  let versions: string | null = null;
  let backfill: string | null = null;
  let renames: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--report") {
      const spec = argv[++i] ?? "";
      const at = spec.lastIndexOf("=");
      const path = spec.slice(0, at);
      const date = spec.slice(at + 1);
      if (at < 1 || !isIsoDate(date))
        throw new Error(`--report attend chemin=AAAA-MM-JJ, reçu « ${spec} »`);
      reports.push({ path, date });
    } else if (arg === "--versions") {
      versions = argv[++i] ?? null;
      if (!versions) throw new Error("--versions attend un dossier");
    } else if (arg === "--backfill") {
      backfill = argv[++i] ?? null;
      if (!backfill) throw new Error("--backfill attend un fichier .sql");
    } else if (arg === "--renames") {
      renames = argv[++i] ?? null;
      if (!renames) throw new Error("--renames attend un fichier .sql");
    } else {
      workbook = arg;
    }
  }
  if ((backfill || renames) && !versions)
    throw new Error("--backfill et --renames demandent --versions");
  return { workbook, reports, versions, backfill, renames };
}

/** Last date a workbook published any figure. */
function lastReportDate(data: SheetData): IsoDate {
  return (
    [...data.chiffre]
      .filter(([, row]) => [...row.values()].some((v) => v > 0))
      .map(([date]) => date)
      .sort()
      .at(-1) ?? ""
  );
}

/** Past versions of the sheet, oldest first; a file's stamp is its name up to the first `_`. */
async function readVersions(folder: string): Promise<SheetVersion[]> {
  const files = (await readdir(resolve(folder)))
    .filter((f) => f.toLowerCase().endsWith(".xlsx"))
    .sort();
  const versions: SheetVersion[] = [];
  for (const [index, file] of files.entries()) {
    const stamp = basename(file, ".xlsx").split("_")[0];
    process.stdout.write(`\r  version ${index + 1}/${files.length} : ${stamp}      `);
    try {
      versions.push({ stamp, data: await readWorkbook(join(resolve(folder), file)) });
    } catch (error) {
      console.warn(
        `\n  ${file} ignorée : ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  process.stdout.write("\n");
  return versions;
}

interface NamedSnapshot {
  date: string;
  source: SnapshotSource;
  rows: (ReportRow & { archived?: boolean })[];
}

/** One life as the import follows it. */
interface Life {
  meta: CompanyMeta;
  firstSeen: IsoDate;
  last: ReportRow;
  lastDate: IsoDate;
  rows: number;
  /** Reports read from a removed column. */
  archived: number;
}

/**
 * Gives each life an id and each page an id. The sheet has one column per name, but a name can
 * carry several lives in turn: a name that comes back after an absence, or whose figures fall back
 * to zero (Paradox, 11 November 2026), opens a new life, on the page of the former one unless
 * listed in SEPARATE_NAMESAKES.
 */
function assignIdentities(
  named: readonly NamedSnapshot[],
  creations: readonly { name: string; date: IsoDate }[],
): { profiles: CompanyProfile[]; companies: CompanyMeta[]; snapshots: Snapshot[]; lives: Life[] } {
  const profiles: CompanyProfile[] = [];
  const companies: CompanyMeta[] = [];
  const lives: Life[] = [];
  const pageOfName = new Map<string, CompanyProfile>();
  const current = new Map<string, Life>();
  let previousDate: string | null = null;

  const snapshots = named.map((snapshot): Snapshot => {
    const rows = snapshot.rows.map(({ archived = false, ...row }) => {
      let life = current.get(row.name);
      const continues =
        life !== undefined && life.lastDate === previousDate && !isRefounding(life.last, row);
      if (life && !continues) life.meta.closedOn ??= snapshot.date;
      if (!life || !continues) {
        let page = pageOfName.get(row.name);
        if (!page || SEPARATE_NAMESAKES.get(row.name)?.includes(snapshot.date)) {
          page = {
            id: String(profiles.length + 1),
            consortiumId: null,
            sector: null,
            logoUrl: null,
            district: null,
            hidden: HIDDEN_COMPANIES.has(row.name),
          };
          profiles.push(page);
          pageOfName.set(row.name, page);
        }
        const meta: CompanyMeta = {
          id: String(companies.length + 1),
          profileId: page.id,
          name: row.name,
          formerNames: [],
          creationOverride: null,
          closedOn: null,
        };
        companies.push(meta);
        life = {
          meta,
          firstSeen: snapshot.date,
          last: row,
          lastDate: snapshot.date,
          rows: 0,
          archived: 0,
        };
        lives.push(life);
      }
      life.last = row;
      life.lastDate = snapshot.date;
      life.rows++;
      if (archived) life.archived++;
      current.set(row.name, life);
      const { name: _name, ...figures } = row;
      return { companyId: life.meta.id, ...figures };
    });
    // Missing from this report: closed for good.
    for (const life of current.values())
      if (life.lastDate === previousDate) life.meta.closedOn ??= snapshot.date;
    previousDate = snapshot.date;
    return { date: snapshot.date, source: snapshot.source, rows };
  });

  // A hand-typed creation date belongs to the first life of that name seen after it.
  for (const { name, date } of creations) {
    const ofName = lives.filter((l) => l.meta.name === name);
    const owner =
      ofName.find((l) => l.firstSeen >= date && l.meta.creationOverride === null) ?? ofName.at(-1);
    if (owner && owner.meta.creationOverride === null) owner.meta.creationOverride = date;
  }
  return { profiles, companies, snapshots, lives };
}

const HOUSE_COLORS: Record<string, ConsortiumColor> = {
  Armacham: "cyan",
  Sovereign: "magenta",
  Donnellys: "ambre",
};

/** Seeds the consortium list from brand words shared by open corporations. */
function seedConsortiums(profiles: CompanyProfile[], companies: CompanyMeta[]): Consortium[] {
  const groups = inferGroups(companies.filter((c) => c.closedOn === null).map((c) => c.name));
  const pages = new Map(profiles.map((p) => [p.id, p]));
  const consortiums: Consortium[] = [];
  for (const company of companies) {
    const name = groups.get(company.name);
    const page = pages.get(company.profileId);
    if (!name || !page) continue;
    let consortium = consortiums.find((k) => k.name === name);
    if (!consortium) {
      consortium = {
        id: String(consortiums.length + 1),
        name,
        color: HOUSE_COLORS[name] ?? "bleu",
      };
      consortiums.push(consortium);
    }
    page.consortiumId = consortium.id;
  }
  // Closed pages join the house their name starts with (Armacham Design), as the backfill does.
  for (const company of companies) {
    const page = pages.get(company.profileId);
    if (!page || page.consortiumId !== null) continue;
    const house = consortiums
      .filter((k) => company.name.startsWith(`${k.name} `))
      .sort((a, b) => b.name.length - a.name.length)[0];
    if (house) page.consortiumId = house.id;
  }
  return consortiums;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const current = await readWorkbook(resolve(args.workbook));
  const currentTracks = current.columns.map((name) => columnTrack(current, name));

  let tracks = currentTracks;
  let former = new Map<string, { names: string[]; lastDate: IsoDate }>();
  let hops: RenamedColumn[] = [];
  // Last dated report of each version: dates the moment a header changed.
  const stampDates = new Map<string, IsoDate>([["current", lastReportDate(current)]]);
  if (args.versions) {
    console.log(`Lecture des versions de ${args.versions}…`);
    const versions = await readVersions(args.versions);
    const removed = removedColumns(versions, current);
    const { tracks: recovered, renamed } = withoutRenamedColumns(removed, currentTracks);
    former = formerNamesOf(renamed);
    hops = renameHops(renamed);
    for (const v of versions) stampDates.set(v.stamp, lastReportDate(v.data));
    tracks = [...currentTracks, ...recovered];
  }

  const merged = mergeTracks(tracks);
  // Only the dates of the current sheet: an old version may hold a mistyped date since corrected.
  const sheetDates = new Set(current.chiffre.keys());
  const named: NamedSnapshot[] = [...merged.rows.keys()]
    .filter((date) => sheetDates.has(date))
    .sort()
    .map((date) => ({
      date,
      source: "sheet",
      rows: merged.rows.get(date) ?? [],
    }));

  for (const report of args.reports) {
    const text = await readFile(resolve(report.path), "utf8");
    const parsed = parseReport(text);
    if (parsed.errors.length > 0) {
      for (const error of parsed.errors) console.error(`  ligne ${error.line} : ${error.reason}`);
      throw new Error(`Rapport ${report.path} illisible`);
    }
    sheetDates.add(report.date);
    const existing = named.findIndex((s) => s.date === report.date);
    const snapshot: NamedSnapshot = { date: report.date, source: "paste", rows: parsed.rows };
    if (existing >= 0) named[existing] = snapshot;
    else named.push(snapshot);
  }
  named.sort((a, b) => a.date.localeCompare(b.date));

  const { profiles, companies, snapshots, lives } = assignIdentities(named, typedCreations(tracks));
  const consortiums = seedConsortiums(profiles, companies);

  // Renamed columns: their former names go to the life that carried them.
  const renamedLives: Life[] = [];
  for (const [name, { names, lastDate }] of former) {
    const ofName = lives.filter((l) => l.meta.name === name);
    const owner = ofName.findLast((l) => l.firstSeen <= lastDate) ?? ofName[0];
    if (!owner) continue;
    owner.meta.formerNames = [
      ...names,
      ...owner.meta.formerNames.filter((n) => !names.includes(n)),
    ];
    renamedLives.push(owner);
  }

  // Each rename, dated when the sheet's header changed, goes to the life that carries the names.
  const events: CompanyEvent[] = [];
  for (const hop of hops) {
    const final = [...former].find(([, f]) => f.names.includes(hop.from))?.[0];
    const owner = renamedLives.find((l) => l.meta.name === final);
    const start = stampDates.get(hop.source);
    const end = stampDates.get(hop.removedIn);
    if (!owner || !end) continue;
    events.push({
      id: `sheet-renamed-${owner.meta.id}-${events.length + 1}`,
      companyId: owner.meta.id,
      date: end,
      kind: "renamed",
      details: { from: hop.from, to: hop.to },
      note:
        start && start !== end
          ? `Relevé dans l'historique du tableur, entre le ${formatImperialDate(start)} et le ${formatImperialDate(end)}.`
          : `Relevé dans l'historique du tableur le ${formatImperialDate(end)}.`,
      origin: "auto",
    });
  }

  const dataset: Dataset = {
    generatedAt: new Date().toISOString(),
    profiles,
    companies,
    consortiums,
    events,
    marketEvents: MARKET_EVENTS,
    ratings: [],
    snapshots,
  };

  const jsonPath = resolve("public/data/history.json");
  await mkdir(dirname(jsonPath), { recursive: true });
  await writeFile(jsonPath, JSON.stringify(dataset));

  const sqlPath = resolve("supabase/seed.sql");
  await mkdir(dirname(sqlPath), { recursive: true });
  await writeFile(sqlPath, toSeedSql(dataset));

  const rowCount = snapshots.reduce((sum, s) => sum + s.rows.length, 0);
  const pagesWithLives = profiles.filter(
    (p) => companies.filter((c) => c.profileId === p.id).length > 1,
  );
  console.log(
    `${profiles.length} fiches, ${companies.length} vies (${companies.filter((c) => c.closedOn).length} fermées, ${pagesWithLives.length} fiches à plusieurs vies), ${consortiums.length} consortiums, ${snapshots.length} relevés (${snapshots[0]?.date} → ${snapshots.at(-1)?.date}), ${rowCount} lignes, ${companies.filter((c) => c.creationOverride).length} dates de création saisies.`,
  );

  if (args.versions) {
    report(tracks, merged, sheetDates, lives, pagesWithLives, companies);
    console.log(`\nAnciens noms retrouvés (${renamedLives.length}) :`);
    for (const life of renamedLives)
      console.log(
        `  ${life.meta.name} — anciennement ${life.meta.formerNames.join(", puis ")}${life.archived === life.rows ? " (récupérée)" : ""}`,
      );
  }

  if (args.renames) {
    const path = resolve(args.renames);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(
      path,
      toRenameEventsSql(
        events.map((e) => {
          const owner = companies.find((c) => c.id === e.companyId)!;
          return { ...e, name: owner.name, closedOn: owner.closedOn };
        }),
      ),
    );
    console.log(`Renommages : ${events.length} évènements → ${args.renames}`);
  }

  if (args.backfill) {
    const recovered: RecoveredLife[] = [];
    for (const life of lives) {
      if (life.archived === 0) continue;
      if (life.archived < life.rows || life.meta.closedOn === null) {
        console.warn(
          `  backfill : ${life.meta.name} (${life.firstSeen}) mêle colonnes actuelle et supprimée ou reste ouverte, à traiter à la main.`,
        );
        continue;
      }
      const rows = snapshots.flatMap((s) => {
        const row = s.rows.find((r) => r.companyId === life.meta.id);
        return row
          ? [{ date: s.date, chiffre: row.chiffre, capital: row.capital, employees: row.employees }]
          : [];
      });
      recovered.push({
        name: life.meta.name,
        formerNames: life.meta.formerNames,
        closedOn: life.meta.closedOn,
        creationOverride: life.meta.creationOverride,
        rows,
      });
    }
    // Lives already in the base: only their former names are added, to the open life.
    const aliases = renamedLives.flatMap((life) => {
      if (life.archived > 0) return [];
      if (life.meta.closedOn !== null) {
        console.warn(
          `  backfill : anciens noms de ${life.meta.name}, vie fermée, à traiter à la main.`,
        );
        return [];
      }
      return [{ name: life.meta.name, formerNames: life.meta.formerNames }];
    });
    const path = resolve(args.backfill);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, toBackfillSql(recovered, aliases));
    console.log(
      `Backfill : ${recovered.length} vies récupérées, anciens noms de ${aliases.length} corporations → ${args.backfill}`,
    );
  }
}

/** What the version history brought back, for the operator to check before publishing it. */
function report(
  tracks: readonly ReturnType<typeof columnTrack>[],
  merged: ReturnType<typeof mergeTracks>,
  sheetDates: ReadonlySet<string>,
  lives: readonly Life[],
  pagesWithLives: readonly CompanyProfile[],
  companies: readonly CompanyMeta[],
): void {
  const recovered = tracks.filter((t) => t.archived && (merged.used.get(t) ?? 0) > 0);
  console.log(`\nColonnes récupérées dans l'historique (${recovered.length}) :`);
  for (const t of recovered.sort((a, b) => a.name.localeCompare(b.name, "fr"))) {
    const dates = [...t.cells.keys()].sort();
    const how = t.reason === "replaced" ? "vidée puis recréée" : "supprimée";
    console.log(
      `  ${t.name} — ${merged.used.get(t)} relevés du ${dates[0]} au ${dates.at(-1)} ; ${how} entre ${t.source} et ${t.removedIn}${t.creation ? ` ; création saisie ${t.creation}` : ""}`,
    );
  }
  const outside = new Set<string>();
  for (const [date, rows] of merged.rows)
    if (!sheetDates.has(date) && rows.some((r: MergedRow) => r.archived)) outside.add(date);
  if (outside.size > 0)
    console.log(
      `\nDates absentes du tableur actuel, ignorées (coquilles corrigées depuis ?) :${[...outside].sort().join(", ")}`,
    );
  if (merged.collisions.length > 0) {
    console.log(`\nChiffres en conflit (${merged.collisions.length}) — gardé / écarté :`);
    for (const c of merged.collisions.slice(0, 40))
      console.log(`  ${c.name} le ${c.date} : ${c.kept} / ${c.dropped}`);
  }
  console.log(`\nFiches à plusieurs vies (${pagesWithLives.length}) :`);
  for (const page of pagesWithLives) {
    const ofPage = lives.filter((l) => l.meta.profileId === page.id);
    const name = companies.find((c) => c.profileId === page.id)?.name ?? page.id;
    console.log(
      `  ${name} — ${ofPage.map((l) => `${l.firstSeen} → ${l.meta.closedOn ?? "ouverte"}${l.archived === l.rows ? " (récupérée)" : ""}`).join(" ; ")}`,
    );
  }
}

await main();
