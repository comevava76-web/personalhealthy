// Only structured, confirmed results are accepted. No document, OCR text or identity fields.
export const LAB_NAMES: Record<string, string> = {
  wbc: 'Globuli bianchi', rbc: 'Globuli rossi', hgb: 'Emoglobina', hct: 'Ematocrito',
  plt: 'Piastrine', mcv: 'MCV', mch: 'MCH', mchc: 'MCHC', glucose: 'Glucosio',
  creatinine: 'Creatinina', urea: 'Urea', uric: 'Acido urico', cholesterol: 'Colesterolo totale',
  hdl: 'Colesterolo HDL', ldl: 'Colesterolo LDL', triglycerides: 'Trigliceridi',
  ast: 'AST', alt: 'ALT', ggt: 'GGT', alp: 'Fosfatasi alcalina', bilirubin: 'Bilirubina totale',
  lipase: 'Lipasi', amylase: 'Amilasi', tsh: 'TSH', ft3: 'FT3', ft4: 'FT4',
  ferritin: 'Ferritina', iron: 'Ferro', crp: 'Proteina C reattiva', sodium: 'Sodio',
  potassium: 'Potassio', calcium: 'Calcio', hba1c: 'HbA1c', vitamin_d: 'Vitamina D', b12: 'Vitamina B12'
};
const units = new Set(['', '%', 'g/dL', 'g/L', 'mg/dL', 'mg/L', 'mmol/L', 'µmol/L', 'U/L', 'IU/L',
  'mIU/L', 'µIU/mL', 'ng/mL', 'pg/mL', 'µg/dL', 'µg/L', 'fL', 'pg', '10^9/L', '10^12/L',
  '10^3/µL', '10^6/µL', '/µL', 'mmol/mol', 'pmol/L', 'nmol/L']);
export function validateLabImport(data: any, now = Date.now()) {
  if (!data || Object.keys(data).some(k => !['id', 'takenAt', 'items', 'confirmed'].includes(k))) return null;
  if (data.confirmed !== true || !/^[a-f0-9-]{36}$/.test(data.id || '')) return null;
  if (!Number.isSafeInteger(data.takenAt) || data.takenAt > now || data.takenAt < now - 365 * 864e5) return null;
  if (!Array.isArray(data.items) || !data.items.length || data.items.length > 200) return null;
  const seen = new Set();
  for (const x of data.items) {
    if (!x || Object.keys(x).some(k => !['code', 'value', 'unit', 'reference'].includes(k))) return null;
    if (!Object.hasOwn(LAB_NAMES, x.code) || seen.has(x.code) || !units.has(x.unit)) return null;
    if (typeof x.value !== 'string' || !/^[<>≤≥]?\s*-?\d{1,9}(?:[.,]\d{1,8})?$/.test(x.value)) return null;
    // Numeric reference intervals only; never accept unstructured source text.
    if (typeof x.reference !== 'string' || !/^(?:[<>≤≥]?\s*-?\d+(?:[.,]\d+)?(?:\s*[-–]\s*-?\d+(?:[.,]\d+)?)?)?$/.test(x.reference) || x.reference.length > 60) return null;
    seen.add(x.code);
  }
  return { id: data.id, takenAt: data.takenAt, items: data.items.map((x: any) => ({ code: x.code, value: x.value, unit: x.unit, reference: x.reference })) };
}
export async function loadLabs(q: (s: string, p?: unknown[]) => Promise<any[]>, pid: string, from: number, to: number) {
  const rows = await q("SELECT id, taken_at, data FROM measurements WHERE person_id = ?1 AND kind = 'lab' AND taken_at >= ?2 AND taken_at <= ?3 ORDER BY taken_at", [pid, from, to]);
  return rows.map(r => ({ id: r.id, t: Number(r.taken_at), items: JSON.parse(r.data).map((x: any) => ({ ...x, name: LAB_NAMES[x.code] })) }));
}
