// Lab reports: only structured results read on the phone. No document, OCR text or identity fields.
// A report is saved whole or not at all; the same file, or the same test on the same day, is never saved twice.
export const LAB_NAMES: Record<string, string> = {
  urine_culture: 'Urinocoltura', wbc: 'Globuli bianchi', rbc: 'Globuli rossi', hgb: 'Emoglobina', hct: 'Ematocrito',
  plt: 'Piastrine', mcv: 'MCV', mch: 'MCH', mchc: 'MCHC', glucose: 'Glucosio',
  creatinine: 'Creatinina', urea: 'Urea', uric: 'Acido urico', cholesterol: 'Colesterolo totale',
  hdl: 'Colesterolo HDL', ldl: 'Colesterolo LDL', triglycerides: 'Trigliceridi',
  ast: 'AST', alt: 'ALT', ggt: 'GGT', alp: 'Fosfatasi alcalina', bilirubin: 'Bilirubina totale',
  lipase: 'Lipasi', amylase: 'Amilasi', tsh: 'TSH', ft3: 'FT3', ft4: 'FT4',
  ferritin: 'Ferritina', iron: 'Ferro', crp: 'Proteina C reattiva', sodium: 'Sodio',
  potassium: 'Potassio', calcium: 'Calcio', hba1c: 'HbA1c', vitamin_d: 'Vitamina D', b12: 'Vitamina B12',
  rdw: "RDW", rdw_sd: "RDW-SD", mpv: "MPV", psa: "PSA", neutrophils: "Neutrofili", neutrophils_pct: "Neutrofili (%)", lymphocytes: "Linfociti", lymphocytes_pct: "Linfociti (%)", monocytes: "Monociti", monocytes_pct: "Monociti (%)", eosinophils: "Eosinofili", eosinophils_pct: "Eosinofili (%)", basophils: "Basofili", basophils_pct: "Basofili (%)"
};
const units = new Set(['', '%', 'g/dL', 'g/L', 'mg/dL', 'mg/L', 'mmol/L', 'µmol/L', 'U/L', 'IU/L',
  'mIU/L', 'µIU/mL', 'ng/mL', 'pg/mL', 'µg/dL', 'µg/L', 'fL', 'pg', '10^9/L', '10^12/L',
  '10^3/µL', '10^6/µL', '/µL', 'mmol/mol', 'pmol/L', 'nmol/L']);
const qualitative = new RegExp("^(?:negative|positive|negativo|negativa|negativi|positivo|positiva|positivi|negativ|positiv|négatif|négative|positif|absent|present|assente|assenti|presente|presenti|abwesend|vorhanden|absente|présent|présente|indeterminate|indeterminato|indeterminata|unbestimmt|indéterminé|indéterminée|non reactive|non reattivo|non reattiva|non réactif|non réactive|nicht reaktiv|reactive|reattivo|reattiva|reaktiv|réactif|réactive|not detected|non rilevato|non rilevata|non rilevati|nicht nachgewiesen|non détecté|non détectée|detected|rilevato|rilevata|rilevati|nachgewiesen|détecté|détectée)$", "iu");
// A test outside the catalog keeps the name printed on the report: letters first, a short label, no ":" or "@"
// (so a "Patient: …" heading or an address cannot pass), at most 8 words.
const customName = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ0-9 .,'’()/+\-]{1,59}$/u;
const customUnit = /^[A-Za-zµ%‰/^0-9.,²³ ]{0,20}$/u;
const EARLIEST = Date.UTC(2000, 0, 1);

/**
 * One row per test across laboratories: the catalog code, or the printed name without case, accents or punctuation;
 * the unit only when it is "%" (a percentage next to an absolute count). The app and the web build the same key.
 */
export const labNameKey = (s: string) => s.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim();
export const labKey = (x: { code: string; name?: string; unit: string }) => x.code || "n:" + labNameKey(String(x.name)) + (x.unit === "%" ? "|%" : "");

export function validateLabImport(data: any, now = Date.now()) {
  if (!data || Object.keys(data).some(k => !['id', 'takenAt', 'items', 'confirmed', 'auto', 'fileHash'].includes(k))) return null;
  // confirmed: an older app, after the person checked every row; auto: the whole document was read and understood.
  if ((data.confirmed !== true && data.auto !== true) || !/^[a-f0-9-]{36}$/.test(data.id || '')) return null;
  if (data.fileHash !== undefined && !/^[a-f0-9]{64}$/.test(data.fileHash)) return null;
  if (data.auto === true && data.fileHash === undefined) return null;
  // The date printed on the report, also an older one. Lab results stay until the person deletes them (see purgeOld).
  if (!Number.isSafeInteger(data.takenAt) || data.takenAt > now || data.takenAt < EARLIEST) return null;
  if (!Array.isArray(data.items) || !data.items.length || data.items.length > 200) return null;
  const seen = new Set();
  const items = [];
  for (const x of data.items) {
    if (!x || Object.keys(x).some(k => !['code', 'name', 'value', 'unit', 'reference'].includes(k))) return null;
    if (typeof x.code !== 'string' || typeof x.unit !== 'string') return null;
    if (x.code) {
      if (!Object.hasOwn(LAB_NAMES, x.code) || x.name !== undefined || !units.has(x.unit)) return null;
    } else {
      if (typeof x.name !== 'string' || !customName.test(x.name) || (x.name.match(/\p{L}/gu) || []).length < 2 || x.name.split(' ').length > 8) return null;
      if (!customUnit.test(x.unit) || (x.unit && !/[\p{L}%‰/]/u.test(x.unit))) return null;
    }
    if (typeof x.value !== 'string' || (!/^[<>≤≥]?\s*-?\d{1,9}(?:[.,]\d{1,8})?$/.test(x.value) && !qualitative.test(x.value))) return null;
    if (qualitative.test(x.value) && x.unit !== '') return null;
    // Numeric intervals or bounded qualitative statuses; never accept arbitrary narrative.
    if (typeof x.reference !== 'string' || (!/^(?:[<>≤≥]?\s*-?\d+(?:[.,]\d+)?(?:\s*[-–]\s*-?\d+(?:[.,]\d+)?)?)?$/.test(x.reference) && !qualitative.test(x.reference)) || x.reference.length > 60) return null;
    const key = labKey(x);
    if (seen.has(key)) return null;
    seen.add(key);
    items.push(x.code ? { code: x.code, value: x.value, unit: x.unit, reference: x.reference } : { code: '', name: x.name.trim(), value: x.value, unit: x.unit, reference: x.reference });
  }
  return { id: data.id as string, takenAt: data.takenAt as number, fileHash: data.fileHash as string | undefined, items };
}

type Q = (s: string, p?: unknown[]) => Promise<any[]>;

/** Every saved report of the person, oldest first, whatever its date: lab results stay until the person deletes them. */
export async function loadLabs(q: Q, pid: string, _from?: number, _to?: number) {
  const rows = await q("SELECT id, taken_at, created_at, data FROM measurements WHERE person_id = ?1 AND kind = 'lab' ORDER BY taken_at", [pid]);
  // c: when it was uploaded, for the upload history in the app
  return rows.map(r => ({ id: r.id, t: Number(r.taken_at), c: Number(r.created_at), items: JSON.parse(r.data).map((x: any) => ({ ...x, name: x.code ? LAB_NAMES[x.code] : x.name })) }));
}

/** A keyed fingerprint of the file: the same document is recognized without keeping anything that could identify it. */
export async function labFileKey(secretB64: string | undefined, pid: string, sha256hex: string): Promise<string> {
  const raw = secretB64 ? Uint8Array.from(atob(secretB64), c => c.charCodeAt(0)) : new Uint8Array(0);
  if (raw.length !== 32) throw new Error("KEY_ENCRYPTION_KEY missing or not 32 bytes");
  const k = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode("lab-file:" + pid + ":" + sha256hex)));
  return "f1:" + [...mac].map(b => b.toString(16).padStart(2, "0")).join("");
}

export type LabSave =
  | { status: "saved"; id: string; saved: number; known: number }
  | { status: "duplicate"; id: string; reason: "file" | "values" }
  | { status: "conflict" };

/**
 * Saves a validated report. Rows already saved for the same day with the same result are skipped; a different result
 * for the same test on the same day stops the whole report (nothing saved). Report and file fingerprint go in one batch.
 */
export async function saveLab(db: D1Database, q: Q, pid: string, lab: NonNullable<ReturnType<typeof validateLabImport>>, fileKey: string | null,
  tz: string, local: (t: number) => string): Promise<LabSave> {
  const id = "lab_" + lab.id;
  if (fileKey) {
    const [seen] = await q("SELECT measurement_id FROM lab_files WHERE person_id = ?1 AND file_hash = ?2", [pid, fileKey]);
    if (seen) return { status: "duplicate", id: seen.measurement_id, reason: "file" };
  }
  const sameDay = await q("SELECT id, data FROM measurements WHERE person_id = ?1 AND kind = 'lab' AND taken_at = ?2", [pid, lab.takenAt]);
  const saved = new Map<string, { value: string; unit: string; id: string }>();
  for (const r of sameDay) for (const x of JSON.parse(r.data)) saved.set(labKey(x), { value: x.value, unit: x.unit, id: r.id });
  const same = (a: string, b: string) => a.replace(",", ".").replace(/\s+/g, "") === b.replace(",", ".").replace(/\s+/g, "");
  const fresh = [];
  for (const x of lab.items) {
    const old = saved.get(labKey(x));
    if (!old) { fresh.push(x); continue; }
    if (!same(old.value, x.value)) return { status: "conflict" };
  }
  if (!fresh.length) return { status: "duplicate", id: sameDay[0].id, reason: "values" };
  const now = Date.now();
  const stmts = [db.prepare("INSERT INTO measurements (id, person_id, kind, taken_at, tz, period, data, source, created_at, taken_at_local, created_at_local) VALUES (?1, ?2, 'lab', ?3, ?4, 'lab', ?5, 'local-import', ?6, ?7, ?8)")
    .bind(id, pid, lab.takenAt, tz, JSON.stringify(fresh), now, local(lab.takenAt), local(now))];
  if (fileKey) stmts.push(db.prepare("INSERT INTO lab_files (person_id, file_hash, measurement_id, created_at) VALUES (?1, ?2, ?3, ?4)").bind(pid, fileKey, id, now));
  await db.batch(stmts);
  return { status: "saved", id, saved: fresh.length, known: lab.items.length - fresh.length };
}

/** Deletes one report, every report of one day (a column of the web table) or all of them, with their file fingerprints. */
export async function deleteLabs(db: D1Database, pid: string, by: { id: string } | { takenAt: number } | { all: true }) {
  const where = "id" in by ? "id = ?2" : "takenAt" in by ? "taken_at = ?2" : "?2 = 1", arg = "id" in by ? by.id : "takenAt" in by ? by.takenAt : 1;
  await db.batch([
    db.prepare(`DELETE FROM lab_files WHERE person_id = ?1 AND measurement_id IN (SELECT id FROM measurements WHERE person_id = ?1 AND kind = 'lab' AND ${where})`).bind(pid, arg),
    db.prepare(`DELETE FROM measurements WHERE person_id = ?1 AND kind = 'lab' AND ${where}`).bind(pid, arg),
  ]);
}
