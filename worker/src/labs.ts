// Only structured, confirmed results are accepted. No document, OCR text or identity fields.
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
const qualitative = new RegExp("^(?:negative|positive|negativo|negativa|positivo|positiva|negativ|positiv|n\u00e9gatif|n\u00e9gative|positif|positive|absent|present|assente|presente|abwesend|vorhanden|absente|pr\u00e9sent|pr\u00e9sente|indeterminate|indeterminato|indeterminata|unbestimmt|ind\u00e9termin\u00e9|ind\u00e9termin\u00e9e|non reactive|non reattivo|non reattiva|non r\u00e9actif|non r\u00e9active|nicht reaktiv|reactive|reattivo|reattiva|reaktiv|r\u00e9actif|r\u00e9active|not detected|non rilevato|non rilevata|nicht nachgewiesen|non d\u00e9tect\u00e9|non d\u00e9tect\u00e9e|detected|rilevato|rilevata|nachgewiesen|d\u00e9tect\u00e9|d\u00e9tect\u00e9e)$", "iu");
export function validateLabImport(data: any, now = Date.now()) {
  if (!data || Object.keys(data).some(k => !['id', 'takenAt', 'items', 'confirmed'].includes(k))) return null;
  if (data.confirmed !== true || !/^[a-f0-9-]{36}$/.test(data.id || '')) return null;
  if (!Number.isSafeInteger(data.takenAt) || data.takenAt > now || data.takenAt < now - 365 * 864e5) return null;
  if (!Array.isArray(data.items) || !data.items.length || data.items.length > 200) return null;
  const seen = new Set();
  for (const x of data.items) {
    if (!x || Object.keys(x).some(k => !['code', 'value', 'unit', 'reference'].includes(k))) return null;
    if (!Object.hasOwn(LAB_NAMES, x.code) || seen.has(x.code) || !units.has(x.unit)) return null;
    if (typeof x.value !== 'string' || (!/^[<>≤≥]?\s*-?\d{1,9}(?:[.,]\d{1,8})?$/.test(x.value) && !qualitative.test(x.value))) return null;
    if (qualitative.test(x.value) && x.unit !== '') return null;
    // Numeric intervals or bounded qualitative statuses; never accept arbitrary narrative.
    if (typeof x.reference !== 'string' || (!/^(?:[<>≤≥]?\s*-?\d+(?:[.,]\d+)?(?:\s*[-–]\s*-?\d+(?:[.,]\d+)?)?)?$/.test(x.reference) && !qualitative.test(x.reference)) || x.reference.length > 60) return null;
    seen.add(x.code);
  }
  return { id: data.id, takenAt: data.takenAt, items: data.items.map((x: any) => ({ code: x.code, value: x.value, unit: x.unit, reference: x.reference })) };
}
export async function loadLabs(q: (s: string, p?: unknown[]) => Promise<any[]>, pid: string, from: number, to: number) {
  const rows = await q("SELECT id, taken_at, data FROM measurements WHERE person_id = ?1 AND kind = 'lab' AND taken_at >= ?2 AND taken_at <= ?3 ORDER BY taken_at", [pid, from, to]);
  return rows.map(r => ({ id: r.id, t: Number(r.taken_at), items: JSON.parse(r.data).map((x: any) => ({ ...x, name: LAB_NAMES[x.code] })) }));
}
