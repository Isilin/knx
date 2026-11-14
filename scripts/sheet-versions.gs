/**
 * KNX — retrouve dans l'historique des versions du tableur « Données entreprises » les colonnes
 * des corporations détruites, supprimées au fil du temps.
 *
 * L'API Drive ne liste que quelques révisions consolidées d'un tableur, mais l'export accepte
 * tous les numéros de révision (une suite d'entiers). Le script parcourt donc les révisions de
 * l'onglet « Chiffre quotidien » de proche en proche, repère chaque colonne qui disparaît (ou qui
 * est vidée puis recréée sous le même nom), cherche par dichotomie la dernière révision où elle
 * est intacte, puis exporte ces révisions-là seulement, en .xlsx.
 *
 * Mise en place (une fois) :
 *   1. Dans le tableur : Extensions → Apps Script.
 *   2. Coller ce fichier à la place du contenu de Code.gs, enregistrer.
 *   3. Services (+) → « Drive API » (v3) → Ajouter.
 *
 * Puis :
 *   - scanRevisions : lance le parcours. Apps Script coupe à 6 minutes : le script s'arrête de
 *     lui-même avant, enregistre où il en est et se relance une minute plus tard (déclencheur),
 *     jusqu'à « Terminé ». Suivre l'avancement dans Exécutions, ou avec scanStatus.
 *   - Télécharger le dossier Drive « KNX — révisions du tableur » (zip) et l'extraire dans
 *     data/source/versions/.
 *   - resetScan : tout reprendre de zéro (efface l'état et le déclencheur, pas les fichiers).
 *   - listVersions, probeRevisions : diagnostics en lecture seule.
 */

const FOLDER_NAME = "KNX — révisions du tableur";
const CHIFFRE_SHEET = "Chiffre quotidien";
const STATE_KEY = "knx-scan";
/** Révisions entre deux échantillons : environ quatre jours d'édition. */
const STEP = 50;
/** Arrêt volontaire avant la coupure d'Apps Script à 6 minutes, attente de 429 comprise. */
const BUDGET_MS = 4 * 60 * 1000;
/** Pause entre deux exports : Google répond 429 quand on enchaîne trop vite. */
const PAUSE_MS = 1500;
const DATE = /^\d{1,2}\/\d{1,2}\/\d{4}$/;

// ---------------------------------------------------------------------------------------------
// Accès aux révisions

function allRevisions_(fileId) {
  const revisions = [];
  let pageToken;
  do {
    const page = Drive.Revisions.list(fileId, {
      pageSize: 1000,
      pageToken: pageToken,
      fields: "nextPageToken,revisions(id,modifiedTime)",
    });
    for (const revision of page.revisions || []) revisions.push(revision);
    pageToken = page.nextPageToken;
  } while (pageToken);
  revisions.sort((a, b) => a.modifiedTime.localeCompare(b.modifiedTime));
  return revisions;
}

/** GET with the script's token; waits and retries on 429 and server errors. Null if it gives up. */
function fetch_(url, token) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = UrlFetchApp.fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      muteHttpExceptions: true,
    });
    const code = response.getResponseCode();
    Utilities.sleep(PAUSE_MS);
    if (code !== 429 && code < 500) return response;
    Utilities.sleep(Math.min(60000, 5000 * 2 ** attempt));
  }
  return null;
}

function context_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return {
    fileId: ss.getId(),
    gid: ss.getSheetByName(CHIFFRE_SHEET).getSheetId(),
    token: ScriptApp.getOAuthToken(),
    cache: new Map(),
    started: Date.now(),
  };
}

const outOfTime_ = (ctx) => Date.now() - ctx.started > BUDGET_MS;

/** Header and dated rows of a « Chiffre quotidien » CSV. */
function parseSheet_(rev, rows) {
  const columns = new Map();
  (rows[0] || []).forEach((name, index) => {
    if (index >= 2 && name.trim() !== "") columns.set(name.trim(), index);
  });
  return { rev, columns, rows: rows.slice(1).filter((row) => DATE.test((row[0] || "").trim())) };
}

/** « Chiffre quotidien » at revision `rev`; null when Google does not serve it. */
function sheetAt_(ctx, rev) {
  if (ctx.cache.has(rev)) return ctx.cache.get(rev);
  const url = `https://docs.google.com/spreadsheets/export?id=${ctx.fileId}&revision=${rev}&exportFormat=csv&gid=${ctx.gid}`;
  const response = fetch_(url, ctx.token);
  ctx.lastCode = response ? response.getResponseCode() : 429;
  const sheet =
    ctx.lastCode === 200 ? parseSheet_(rev, Utilities.parseCsv(response.getContentText())) : null;
  ctx.cache.set(rev, sheet);
  return sheet;
}

/** First revision from `rev` (at most `limit`) that Google serves. */
function servedFrom_(ctx, rev, limit) {
  for (let r = rev; r <= limit && r < rev + 6; r++) {
    const sheet = sheetAt_(ctx, r);
    if (sheet) return sheet;
  }
  return null;
}

/**
 * The column `name` of `ref` is still whole in `other`: present, and at least half of its
 * published figures (dates `other` also has) unchanged. A column deleted and re-created empty
 * under the same name fails.
 */
function intact_(ref, other, name) {
  if (!other || !other.columns.has(name)) return false;
  const from = ref.columns.get(name);
  const to = other.columns.get(name);
  const byDate = new Map(other.rows.map((row) => [row[0].trim(), row]));
  let held = 0;
  let lost = 0;
  for (const row of ref.rows) {
    const value = (row[from] || "").trim();
    if (!/[1-9]/.test(value)) continue;
    const later = byDate.get(row[0].trim());
    if (!later) continue;
    held++;
    if ((later[to] || "").trim() !== value) lost++;
  }
  return lost * 2 <= held;
}

// ---------------------------------------------------------------------------------------------
// État du parcours, conservé entre deux exécutions

function loadState_() {
  const raw = PropertiesService.getScriptProperties().getProperty(STATE_KEY);
  return raw ? JSON.parse(raw) : null;
}

function saveState_(state) {
  PropertiesService.getScriptProperties().setProperty(STATE_KEY, JSON.stringify(state));
}

function clearTriggers_() {
  for (const trigger of ScriptApp.getProjectTriggers())
    if (trigger.getHandlerFunction() === "scanRevisions") ScriptApp.deleteTrigger(trigger);
}

/** Replaces the pending resumption with one `minutes` from now. */
function scheduleNext_(minutes) {
  clearTriggers_();
  ScriptApp.newTrigger("scanRevisions")
    .timeBased()
    .after(minutes * 60 * 1000)
    .create();
}

function folderNamed_(name) {
  const found = DriveApp.getFoldersByName(name);
  return found.hasNext() ? found.next() : DriveApp.createFolder(name);
}

const fileName_ = (rev) => `r${String(rev).padStart(6, "0")}.xlsx`;

// ---------------------------------------------------------------------------------------------
// Parcours

/**
 * Narrows `task` ({ name, lo, hi }: the column is whole at `lo`, not at `hi`) to two neighbouring
 * revisions, saving each step. Returns false when time runs out.
 */
function narrow_(ctx, task, save) {
  let ref = sheetAt_(ctx, task.lo);
  while (ref && task.hi - task.lo > 1) {
    if (outOfTime_(ctx)) return false;
    const mid = Math.floor((task.lo + task.hi) / 2);
    const sheet = servedFrom_(ctx, mid, task.hi - 1);
    if (!sheet) {
      task.hi = mid;
      continue;
    }
    if (intact_(ref, sheet, task.name)) {
      task.lo = sheet.rev;
      ref = sheet;
    } else {
      task.hi = sheet.rev;
    }
    save();
  }
  return true;
}

function scanRevisions() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    console.log("Une exécution est déjà en cours.");
    return;
  }
  try {
    // A safety net if Apps Script cuts this run short: the next one starts anyway.
    scheduleNext_(7);
    scan_();
  } catch (error) {
    // A real error would only repeat: stop resuming until it is fixed.
    clearTriggers_();
    throw error;
  } finally {
    lock.releaseLock();
  }
}

/**
 * First revision Google serves « Chiffre quotidien » for: the sheet did not exist in the very
 * first revisions of the file. Found by bisection, the latest revision being served.
 */
function firstServed_(ctx, top) {
  if (!sheetAt_(ctx, top))
    throw new Error(
      `La révision ${top} (la dernière) n'est pas servie (HTTP ${ctx.lastCode}) : réessayer plus tard.`,
    );
  let lo = 0;
  let hi = top;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (sheetAt_(ctx, mid)) hi = mid;
    else lo = mid;
  }
  return sheetAt_(ctx, hi);
}

function scan_() {
  const ctx = context_();
  let state = loadState_();
  if (!state) {
    const top = Math.max(...allRevisions_(ctx.fileId).map((r) => Number(r.id)));
    const first = firstServed_(ctx, top);
    state = { top, prev: first.rev, tasks: [], targets: [], exported: [], phase: "scan" };
    console.log(`Parcours des révisions ${first.rev} à ${top}, par pas de ${STEP}.`);
    saveState_(state);
  }

  while (state.phase === "scan") {
    // Columns already seen going: find the last revision that holds each whole.
    while (state.tasks.length > 0) {
      const task = state.tasks[0];
      if (!narrow_(ctx, task, () => saveState_(state))) return pause_(state);
      console.log(`« ${task.name} » : dernière révision intacte ${task.lo}.`);
      if (!state.targets.includes(task.lo)) state.targets.push(task.lo);
      state.tasks.shift();
      saveState_(state);
    }
    if (state.prev >= state.top) {
      state.phase = "export";
      saveState_(state);
      break;
    }
    if (outOfTime_(ctx)) return pause_(state);

    const before = sheetAt_(ctx, state.prev);
    const after = servedFrom_(ctx, Math.min(state.prev + STEP, state.top), state.top);
    if (!before || !after) {
      // Nothing served in this stretch: step over it.
      state.prev = Math.min(state.prev + STEP, state.top);
      saveState_(state);
      continue;
    }
    for (const name of before.columns.keys())
      if (!intact_(before, after, name)) {
        console.log(`« ${name} » disparaît entre les révisions ${before.rev} et ${after.rev}.`);
        state.tasks.push({ name, lo: before.rev, hi: after.rev });
      }
    state.prev = after.rev;
    saveState_(state);
  }

  if (state.phase === "export") {
    const folder = folderNamed_(FOLDER_NAME);
    for (const rev of [...state.targets].sort((a, b) => a - b)) {
      if (state.exported.includes(rev)) continue;
      if (outOfTime_(ctx)) return pause_(state);
      const url = `https://docs.google.com/spreadsheets/export?id=${ctx.fileId}&revision=${rev}&exportFormat=xlsx`;
      const response = fetch_(url, ctx.token);
      if (!response || response.getResponseCode() !== 200) {
        console.log(`Révision ${rev} : export refusé, réessai à la prochaine exécution.`);
        return pause_(state);
      }
      folder.createFile(response.getBlob().setName(fileName_(rev)));
      state.exported.push(rev);
      saveState_(state);
    }
    state.phase = "done";
    saveState_(state);
  }

  clearTriggers_();
  console.log(
    `Terminé : ${state.targets.length} révisions exportées dans « ${FOLDER_NAME} ». Télécharger le dossier et l'extraire dans data/source/versions/.`,
  );
}

function pause_(state) {
  saveState_(state);
  scheduleNext_(1);
  console.log(
    `Pause à la révision ${state.prev}/${state.top} (${state.tasks.length} colonne(s) en cours, ${state.targets.length} révision(s) retenue(s), ${state.exported.length} exportée(s)). Reprise automatique dans une minute.`,
  );
}

function scanStatus() {
  const state = loadState_();
  if (!state) {
    console.log("Aucun parcours en cours : lancer scanRevisions.");
    return;
  }
  console.log(
    `Phase ${state.phase} : révision ${state.prev}/${state.top}, ${state.tasks.length} colonne(s) en cours, ${state.targets.length} révision(s) retenue(s), ${state.exported.length} exportée(s).`,
  );
  for (const task of state.tasks)
    console.log(`  en cours : « ${task.name} » entre ${task.lo} et ${task.hi}`);
  const waiting = ScriptApp.getProjectTriggers().filter(
    (t) => t.getHandlerFunction() === "scanRevisions",
  ).length;
  console.log(waiting > 0 ? "Reprise programmée." : "Aucune reprise programmée.");
}

function resetScan() {
  clearTriggers_();
  PropertiesService.getScriptProperties().deleteProperty(STATE_KEY);
  console.log("État effacé. Les fichiers déjà exportés restent dans le dossier Drive.");
}

// ---------------------------------------------------------------------------------------------
// Diagnostics

function describe_(sheet) {
  const dates = sheet.rows.map((row) => row[0].trim());
  return `${sheet.columns.size} colonnes, ${dates.length} lignes datées (${dates[0] || "—"} → ${dates[dates.length - 1] || "—"})`;
}

/** Révisions que Drive liste (quelques révisions consolidées seulement). */
function listVersions() {
  const tz = Session.getScriptTimeZone();
  const revisions = allRevisions_(SpreadsheetApp.getActiveSpreadsheet().getId());
  console.log(`${revisions.length} révisions listées par Drive.`);
  for (const r of revisions)
    console.log(
      `Révision ${r.id} — ${Utilities.formatDate(new Date(r.modifiedTime), tz, "yyyy-MM-dd HH:mm")}`,
    );
}

/** « Chiffre quotidien » à quelques numéros de révision, listés ou non par Drive. */
function probeRevisions() {
  const ctx = context_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const live = parseSheet_(0, ss.getSheetByName(CHIFFRE_SHEET).getDataRange().getDisplayValues());
  console.log(`Aujourd'hui : ${describe_(live)}.`);
  const top = Math.max(...allRevisions_(ctx.fileId).map((r) => Number(r.id)));
  for (const f of [1, 0.9, 0.75, 0.5, 0.25, 0.1]) {
    const rev = Math.max(1, Math.round(top * f));
    const sheet = sheetAt_(ctx, rev);
    console.log(`Révision ${rev} : ${sheet ? describe_(sheet) : "non servie"}.`);
  }
}
