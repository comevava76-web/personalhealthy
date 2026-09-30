package ch.personalhealthy.app

// Reading a lab report: plain Kotlin, no Android, so it runs in unit tests. The document never leaves the phone;
// only the rows returned here (and the report date) are sent, after the whole document was understood.
import org.json.JSONObject
import java.time.LocalDate

data class LabDefinition(val code: String, val name: String, val aliases: List<String>)
val labDefinitions = listOf(
    LabDefinition("urine_culture", "Urinocoltura", listOf("urinocoltura", "urine culture", "urinkultur", "culture urinaire", "ecbu")),
    LabDefinition("wbc", "Globuli bianchi", listOf("globuli bianchi", "leucociti", "wbc", "white blood cells", "white blood cells", "globuli bianchi", "leukozyten", "leucocytes")),
    LabDefinition("rbc", "Globuli rossi", listOf("globuli rossi", "eritrociti", "rbc", "red blood cells", "globuli rossi", "erythrozyten", "hématies")),
    LabDefinition("hgb", "Emoglobina", listOf("emoglobina", "hemoglobin", "hgb", "hb", "hemoglobin", "emoglobina", "hämoglobin", "hémoglobine")),
    LabDefinition("hct", "Ematocrito", listOf("ematocrito", "hematocrit", "hct", "hematocrit", "ematocrito", "hämatokrit", "hématocrite")),
    LabDefinition("plt", "Piastrine", listOf("piastrine", "platelets", "plt", "platelets", "piastrine", "thrombozyten", "plaquettes")),
    LabDefinition("mcv", "MCV", listOf("volume corpuscolare medio", "mcv", "mcv", "mcv", "mcv", "vgm")), LabDefinition("mch", "MCH", listOf("contenuto medio hgb", "mch", "mch", "mch", "mch", "tcmh")),
    LabDefinition("mchc", "MCHC", listOf("concentrazione media hgb", "mchc", "mchc", "mchc", "mchc", "ccmh")),
    LabDefinition("glucose", "Glucosio", listOf("glucosio", "glicemia", "glucose", "glucose", "glucosio", "glukose", "glucose")),
    LabDefinition("creatinine", "Creatinina", listOf("creatinina", "creatinine", "creatinine", "creatinina", "kreatinin", "créatinine")),
    LabDefinition("urea", "Urea", listOf("urea", "azotemia", "urea", "urea", "harnstoff", "urée")),
    LabDefinition("uric", "Acido urico", listOf("acido urico", "uric acid", "uric acid", "acido urico", "harnsäure", "acide urique")),
    LabDefinition("hdl", "Colesterolo HDL", listOf("colesterolo hdl", "hdl", "hdl cholesterol", "colesterolo hdl", "hdl-cholesterin", "cholestérol hdl")),
    LabDefinition("ldl", "Colesterolo LDL", listOf("colesterolo ldl", "ldl", "ldl cholesterol", "colesterolo ldl", "ldl-cholesterin", "cholestérol ldl")),
    LabDefinition("cholesterol", "Colesterolo totale", listOf("colesterolo totale", "total cholesterol", "total cholesterol", "colesterolo totale", "gesamtcholesterin", "cholestérol total")),
    LabDefinition("triglycerides", "Trigliceridi", listOf("trigliceridi", "triglycerides", "triglycerides", "trigliceridi", "triglyzeride", "triglycérides")),
    LabDefinition("ast", "AST", listOf("ast", "got", "ast", "ast", "ast", "asat")), LabDefinition("alt", "ALT", listOf("alt", "gpt", "alt", "alt", "alt", "alat")),
    LabDefinition("ggt", "GGT", listOf("gamma gt", "gamma-gt", "ggt", "ggt", "ggt", "ggt", "ggt")),
    LabDefinition("alp", "Fosfatasi alcalina", listOf("fosfatasi alcalina", "alkaline phosphatase", "alkaline phosphatase", "fosfatasi alcalina", "alkalische phosphatase", "phosphatase alcaline")),
    LabDefinition("bilirubin", "Bilirubina totale", listOf("bilirubina totale", "total bilirubin", "total bilirubin", "bilirubina totale", "gesamtbilirubin", "bilirubine totale")),
    LabDefinition("lipase", "Lipasi", listOf("lipasi", "lipase", "lipase", "lipasi", "lipase", "lipase")),
    LabDefinition("amylase", "Amilasi", listOf("amilasi", "amylase", "amylase", "amilasi", "amylase", "amylase")),
    LabDefinition("tsh", "TSH", listOf("tsh", "tsh", "tsh", "tsh", "tsh")), LabDefinition("ft3", "FT3", listOf("ft3", "ft3", "ft3", "ft3", "ft3")),
    LabDefinition("ft4", "FT4", listOf("ft4", "ft4", "ft4", "ft4", "ft4")),
    LabDefinition("ferritin", "Ferritina", listOf("ferritina", "ferritin", "ferritin", "ferritina", "ferritin", "ferritine")),
    LabDefinition("iron", "Ferro", listOf("ferro", "sideremia", "iron", "iron", "ferro", "eisen", "fer")),
    LabDefinition("crp", "Proteina C reattiva", listOf("proteina c reattiva", "c-reactive protein", "crp", "c-reactive protein", "proteina c reattiva", "c-reaktives protein", "protéine c réactive")),
    LabDefinition("sodium", "Sodio", listOf("sodio", "sodium", "sodium", "sodio", "natrium", "sodium")),
    LabDefinition("potassium", "Potassio", listOf("potassio", "potassium", "potassium", "potassio", "kalium", "potassium")),
    LabDefinition("calcium", "Calcio", listOf("calcio", "calcium", "calcium", "calcio", "kalzium", "calcium")),
    LabDefinition("hba1c", "HbA1c", listOf("hba1c", "emoglobina glicata", "hba1c", "hba1c", "hba1c", "hba1c")),
    LabDefinition("vitamin_d", "Vitamina D", listOf("25-idrossi vitamina d", "25 hydroxy vitamin d", "25-hydroxy vitamin d", "vitamina d", "vitamin d", "25-oh vitamina d", "vitamin d", "vitamina d", "vitamin d", "vitamine d")),
    LabDefinition("b12", "Vitamina B12", listOf("vitamina b12", "vitamin b12", "vitamin b12", "vitamina b12", "vitamin b12", "vitamine b12")),
    LabDefinition("rdw", "RDW", listOf("distribuzione vol. eritrocitario", "rdw")),
    LabDefinition("rdw_sd", "RDW-SD", listOf("distribuzione vol. eritrocitario (rdw-sd)", "rdw-sd")),
    LabDefinition("mpv", "MPV", listOf("mpv", "mean platelet volume")),
    LabDefinition("psa", "PSA", listOf("antigene prostatico specifico", "prostate specific antigen", "prostate-specific antigen", "psa")),
    LabDefinition("neutrophils", "Neutrofili", listOf("granulociti neutrofili", "neutrofili", "neutrophils", "neutrophile", "neutrophiles")),
    LabDefinition("neutrophils_pct", "Neutrofili (%)", listOf()),
    LabDefinition("lymphocytes", "Linfociti", listOf("linfociti assoluti", "linfociti", "lymphocytes", "lymphozyten")),
    LabDefinition("lymphocytes_pct", "Linfociti (%)", listOf()),
    LabDefinition("monocytes", "Monociti", listOf("monociti", "monocytes", "monozyten")),
    LabDefinition("monocytes_pct", "Monociti (%)", listOf()),
    LabDefinition("eosinophils", "Eosinofili", listOf("granulociti eosinofili", "eosinofili", "eosinophils", "eosinophile", "éosinophiles")),
    LabDefinition("eosinophils_pct", "Eosinofili (%)", listOf()),
    LabDefinition("basophils", "Basofili", listOf("granulociti basofili", "basofili", "basophils", "basophile", "basophiles")),
    LabDefinition("basophils_pct", "Basofili (%)", listOf())
)
/** One result as printed: a catalog code (translated name, trends across reports) or, for a test outside the catalog, the name as printed. */
data class LabValue(val code: String, val value: String, val unit: String, val reference: String, val label: String = "") {
    fun json(): JSONObject = JSONObject().put("code", code).put("value", value).put("unit", unit).put("reference", reference).also { if (code.isEmpty()) it.put("name", label) }
    /**
     * One row per test across laboratories: the catalog code (its synonyms included), otherwise the printed name without
     * case, accents or punctuation. The unit is not part of it (laboratories use different units), except "%", which
     * marks a percentage next to an absolute count. The same key on the same day is stored once (the server agrees).
     */
    val key: String get() = code.ifEmpty { "n:" + labNameKey(label) + if (unit == "%") "|%" else "" }
}

/** The whole document is read, then either every result row and one report date are certain, or nothing is saved. */
sealed class LabRead {
    data class Ok(val date: LocalDate, val values: List<LabValue>) : LabRead()
    /** reason: no_date, ambiguous_date, future_date, no_results, unreadable_rows (count = rows not understood), duplicate_tests */
    data class Failed(val reason: String, val count: Int = 0) : LabRead()
}

private val labNumber = Regex("[<>≤≥]?\\s*-?\\d{1,9}(?:[.,]\\d{1,8})?")
private val labUnit = Regex("(?:10\\^[369]|10\\^12)/(?:L|[µμu]L)|(?:[µμu]?mol|mmol|nmol|pmol|mIU|[µμu]IU|IU|U|ng|pg|[µμu]g|mg|g)/(?:dL|mL|L)|mmol/mol|fL|pg|%", RegexOption.IGNORE_CASE)
private fun normalizeUnit(s: String): String = s.replace('μ', 'µ').replace("uL", "µL").replace("ug", "µg").replace("umol", "µmol").replace("uIU", "µIU")
private val labAliases = labDefinitions.flatMap { d -> d.aliases.distinct().map { d to it } }.sortedByDescending { it.second.length }
private val differentialCodes = setOf("neutrophils", "lymphocytes", "monocytes", "eosinophils", "basophils")
private const val QUALITATIVE = "negative|positive|negativo|negativa|negativi|negative|positivo|positiva|positivi|negativ|positiv|négatif|négative|positif|absent|present|assente|assenti|presente|presenti|abwesend|vorhanden|absente|présent|présente|indeterminate|indeterminato|indeterminata|unbestimmt|indéterminé|indéterminée|non reactive|non reattivo|non reattiva|non réactif|non réactive|nicht reaktiv|reactive|reattivo|reattiva|reaktiv|réactif|réactive|not detected|non rilevato|non rilevata|non rilevati|nicht nachgewiesen|non détecté|non détectée|detected|rilevato|rilevata|rilevati|nachgewiesen|détecté|détectée"
private val labQualitative = Regex("(?:$QUALITATIVE)", RegexOption.IGNORE_CASE)
private val catalogUnits = listOf("%", "g/dL", "g/L", "mg/dL", "mg/L", "mmol/L", "µmol/L", "U/L", "IU/L", "mIU/L", "µIU/mL", "ng/mL", "pg/mL", "µg/dL", "µg/L", "fL", "pg", "10^9/L", "10^12/L", "10^3/µL", "10^6/µL", "mmol/mol", "pmol/L", "nmol/L")
private val labQualifier = Regex("^(?:(?:a\\s+digiuno|calcolat[oa]|dirett[oa]|sieric[oa]|plasmatic[oa]|basale|totale|fasting|calculated|direct|serum|plasma|nüchtern|berechnet|direkt|à\\s+jeun|calculé|direct)\\s+){1,2}(?=[<>≤≥]?\\s*-?\\d)", RegexOption.IGNORE_CASE)
private val specimen = Regex("^(?:Sg|S|P|B|U|Pl|WB)-\\s*", RegexOption.IGNORE_CASE)
private val numericReference = Regex("^(?:[<>≤≥]\\s*\\d+(?:[.,]\\d+)?|\\d+(?:[.,]\\d+)?\\s*[-–]\\s*\\d+(?:[.,]\\d+)?)")
private const val REF_LABEL = "(?:Range previsto|Valori di riferimento|Reference range|Referenzbereich|Valeurs de référence)\\s*:\\s*"
private val referenceLabel = Regex("^$REF_LABEL", RegexOption.IGNORE_CASE)

/** A test in the catalog: only its own grammar applies, so a label can never hide an identifier (the row is then unreadable). */
private fun parseCatalogRow(line: String): LabValue? {
    val pair = labAliases.firstOrNull { (_, alias) -> Regex("^" + Regex.escape(alias) + "(?=\\s|[:(]|$)", RegexOption.IGNORE_CASE).containsMatchIn(line) } ?: return null
    var rest = line.substring(pair.second.length).trimStart(' ', ':', '\t')
    val suffix = Regex("^\\(([A-Za-z0-9% -]{1,16})\\)\\s*").find(rest)
    if (suffix != null) {
        val acronym = suffix.groupValues[1]
        if (pair.first.aliases.none { it.equals(acronym, ignoreCase = true) } && !(pair.first.code == "plt" && acronym.equals("plts", ignoreCase = true))) return null
        rest = rest.substring(suffix.range.last + 1)
    }
    val qualitative = labQualitative.matchEntire(rest.trim())
    if (qualitative != null) return LabValue(pair.first.code, qualitative.value, "", "")
    // a laboratory may qualify the name ("Glucosio a digiuno", "Colesterolo LDL calcolato"): only these words, so that
    // "Glucosio nelle urine" can never land on the blood glucose row (it stays unreadable, and nothing is saved)
    labQualifier.find(rest)?.let { rest = rest.substring(it.range.last + 1) }
    // Anchor the result before its unit: digits inside labels/units must never become values.
    val value = labNumber.find(rest)?.takeIf { it.range.first == 0 } ?: return null
    val tail = rest.substring(value.range.last + 1).trimStart().trimStart('*', ' ').replace(Regex("^[x×]\\s*(?=10)"), "")
    val unit = labUnit.find(tail)?.takeIf { it.range.first == 0 } ?: return null
    val refText = tail.substring(unit.range.last + 1).trim().trimStart('*', ' ').replace(referenceLabel, "")
    val ref = numericReference.find(refText)?.value ?: ""
    val canonical = catalogUnits.firstOrNull { it.equals(normalizeUnit(unit.value), ignoreCase = true) } ?: return null
    val code = if (pair.first.code in differentialCodes && canonical == "%") pair.first.code + "_pct" else pair.first.code
    if (pair.first.code in differentialCodes && canonical !in listOf("%", "10^9/L", "10^3/µL")) return null
    return LabValue(code, value.value.trim(), canonical, ref)
}

// A test outside the catalog: name as printed, then the result, then a unit and/or a reference interval.
// Without a known unit or a reference the row is not taken: "Mario Rossi 45 anni" must never become a test.
private const val GENERIC_UNIT = "(?:x?\\s*10\\^\\d{1,2}/[µμu]?L|[µμu]?(?:mol|mmol|nmol|pmol|g|mg|µg|ng|pg|kU|U|UI|IU|mIU|mUI|µUI|µIU|mEq|Eq|kat|µkat|AU|cell[e]?|cells|mOsm)/(?:[µμu]?L|dL|mL|l|kg|h|24h|min|mm3|mm³|mol)|mL/min(?:/1[.,]73\\s*m[²2])?|/[µμu]L|/mm[3³]|/HPF|/campo|mm/h|%|‰|fL|pg|sec|s|mmol/mol|ratio)"
private val genericRow = Regex(
    "^([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ0-9 .,'’()/+\\-]{1,58}?)\\s+" +      // name
    "([<>≤≥]?\\s*-?\\d{1,9}(?:[.,]\\d{1,8})?)" +                                // value
    "(?:\\s*(?:\\*|[HL]|↑|↓)(?=\\s|$))?" +                                    // a flag printed by the lab, ignored
    "(?:\\s+($GENERIC_UNIT))?" +                                              // unit
    "(?:\\s+(?:$REF_LABEL)?([<>≤≥]\\s*\\d+(?:[.,]\\d+)?|\\d+(?:[.,]\\d+)?\\s*[-–]\\s*\\d+(?:[.,]\\d+)?))?" + // reference
    "(?:\\s+\\3)?\\s*$", RegexOption.IGNORE_CASE)
private val genericQualitative = Regex("^([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ0-9 .,'’()/+\\-]{1,58}?)\\s+($QUALITATIVE)(?:\\s+($QUALITATIVE))?\\s*$", RegexOption.IGNORE_CASE)
// Words that start patient, doctor, address or document headings: never a test name.
private val notATest = Regex("^(?:paziente|patient|patientin|nome|name|cognome|nato|nata|born|geboren|né|née|data|date|datum|indirizzo|address|adresse|via|tel|telefono|phone|fax|medico|doctor|dott|dr|arzt|codice|code|id|n\\.|nr|pagina|page|seite|richiesta|accettazione|referto|report|befund|laboratorio|laboratory|labor|ospedale|hospital|età|age|alter|sesso|sex|firma|signature|stampa|print)\\b", RegexOption.IGNORE_CASE)
// Lines that explain a reference (lipids, vitamin D…): part of the previous result, not a result of their own.
private val referenceWords = Regex("\\b(?:ottimal[ei]|desiderabil[ei]|borderline|elevat[oia]|molto|rischio|normal[ei]|carenza|insufficien|sufficien|tossic|optimal|desirable|high|low|risk|deficien|toxic|wünschenswert|hoch|niedrig|mangel|souhaitable|élevé|faible|risque|carence)\\b", RegexOption.IGNORE_CASE)

private fun cleanName(s: String) = s.replace(Regex("\\s+"), " ").trim().trimEnd(':', '.', ',', ' ')

private fun parseGenericRow(line: String): LabValue? {
    genericQualitative.matchEntire(line)?.let { m ->
        val name = cleanName(m.groupValues[1])
        if (notATest.containsMatchIn(name) || name.count { it.isLetter() } < 2) return null
        return LabValue("", m.groupValues[2], "", m.groupValues[3], name)
    }
    val m = genericRow.matchEntire(line) ?: return null
    val name = cleanName(m.groupValues[1]); val unit = m.groupValues[3]; val ref = m.groupValues[4]
    if (unit.isEmpty() && ref.isEmpty()) return null
    if (notATest.containsMatchIn(name) || name.count { it.isLetter() } < 2 || name.split(' ').size > 8) return null
    val canonical = catalogUnits.firstOrNull { it.equals(normalizeUnit(unit.replace(Regex("^x\\s*"), "")), ignoreCase = true) } ?: normalizeUnit(unit.replace(Regex("^x\\s*"), ""))
    return LabValue("", m.groupValues[2].trim(), canonical, ref.trim(), name)
}

// A line that looks like a result: a number followed by a unit, or a numeric interval. Dates, times, phone and page
// numbers are not results. Every such line must be understood, or the report is not saved.
private val resultLike = Regex("\\d(?:[.,]\\d+)?\\s*(?:x\\s*)?$GENERIC_UNIT(?=\\s|$)|\\d(?:[.,]\\d+)?\\s*[-–]\\s*\\d", RegexOption.IGNORE_CASE)
private val unitAfterNumber = Regex("\\d(?:[.,]\\d+)?\\s*(?:x\\s*)?$GENERIC_UNIT(?=\\s|$)", RegexOption.IGNORE_CASE)
private val notResultLine = Regex("\\b\\d{1,2}[./-]\\d{1,2}[./-]\\d{2,4}\\b|\\b\\d{4}-\\d{2}-\\d{2}\\b|\\b\\d{1,2}:\\d{2}\\b|\\b(?:tel|telefono|phone|fax|pagina|page|seite|p\\.)\\b|\\bCAP\\b|@", RegexOption.IGNORE_CASE)

private fun prepare(raw: String) = raw.replace(' ', ' ').replace('−', '-').replace(Regex("[ \t]+"), " ").trim().replace(specimen, "")

/** Parsed rows only (a helper for tests and for pages with embedded text): unreadable lines are skipped, not reported. */
fun parseLabLines(text: String): List<LabValue> = text.lineSequence().map(::prepare).mapNotNull { line ->
    if (labAliases.any { (_, a) -> Regex("^" + Regex.escape(a) + "(?=\\s|[:(]|$)", RegexOption.IGNORE_CASE).containsMatchIn(line) }) parseCatalogRow(line) else parseGenericRow(line)
}.toList()

/** The whole report: one certain date and every result line understood; otherwise a reason and nothing to save. */
fun readLabText(text: String, today: LocalDate): LabRead {
    val values = mutableListOf<LabValue>(); var unreadable = 0
    for (raw in text.lines()) {
        val line = prepare(raw)
        if (line.isEmpty()) continue
        val catalog = labAliases.any { (_, a) -> Regex("^" + Regex.escape(a) + "(?=\\s|[:(]|$)", RegexOption.IGNORE_CASE).containsMatchIn(line) }
        val row = if (catalog) parseCatalogRow(line) else parseGenericRow(line)
        if (row != null) { values += row; continue }
        // A line describing a reference ("Desiderabile < 200") belongs to the result above it; with a unit it is a result.
        val explainsReference = referenceWords.containsMatchIn(line) && !unitAfterNumber.containsMatchIn(line)
        val looksLikeResult = resultLike.containsMatchIn(line) && !notResultLine.containsMatchIn(line) && !notATest.containsMatchIn(line) && !explainsReference
        if (looksLikeResult || (catalog && line.any { it.isDigit() } && !notResultLine.containsMatchIn(line))) unreadable++
    }
    if (unreadable > 0) return LabRead.Failed("unreadable_rows", unreadable)
    if (values.isEmpty()) return LabRead.Failed("no_results")
    if (values.groupBy { it.key }.any { it.value.size > 1 }) return LabRead.Failed("duplicate_tests")
    val date = when (val d = findReportDate(text)) { null -> return LabRead.Failed("no_date"); else -> d }
    if (date == LocalDate.MIN) return LabRead.Failed("ambiguous_date")
    if (date.isAfter(today) || date.year < 2000) return LabRead.Failed("future_date")
    return LabRead.Ok(date, values)
}

private fun dates(text: String, labels: String): List<LocalDate> =
    Regex("(?:$labels)\\s*:?\\s*(\\d{1,4}[-/.]\\d{1,2}[-/.]\\d{1,4})", RegexOption.IGNORE_CASE).findAll(text).mapNotNull { match ->
        val parts = match.groupValues[1].split('-', '/', '.')
        runCatching {
            if (parts[0].length == 4) LocalDate.of(parts[0].toInt(), parts[1].toInt(), parts[2].toInt())
            else if (parts[2].length == 4) LocalDate.of(parts[2].toInt(), parts[1].toInt(), parts[0].toInt())
            else null
        }.getOrNull()
    }.distinct().toList()

private const val REPORT_DATE = "referto\\s+del|data\\s+(?:del\\s+)?referto|data\\s+refertazione|refertato\\s+il|report\\s+date|date\\s+of\\s+report|befunddatum|befund\\s+vom|date\\s+du\\s+(?:compte[- ]rendu|rapport)"
private const val SAMPLE_DATE = "data\\s+(?:del\\s+)?prelievo|prelievo\\s+del|prelevato\\s+il|collection\\s+date|date\\s+collected|entnahmedatum|entnahme\\s+vom|date\\s+(?:du|de)\\s+prélèvement"

/**
 * The date printed as the report date; only when there is none, the sampling date. Never a date of birth, a request
 * date or today. Returns null when absent and LocalDate.MIN when the document shows different dates.
 */
fun findReportDate(text: String): LocalDate? {
    val report = dates(text, REPORT_DATE)
    if (report.size > 1) return LocalDate.MIN
    report.singleOrNull()?.let { return it }
    val sample = dates(text, SAMPLE_DATE)
    return if (sample.size > 1) LocalDate.MIN else sample.singleOrNull()
}

/** Kept for the existing callers and tests: the report date or null (absent or ambiguous). */
fun parseLabReportDate(text: String): LocalDate? = findReportDate(text)?.takeIf { it != LocalDate.MIN }

/**
 * Compared only with the reference printed next to it on the same report: 1 above, -1 below, 0 inside or not comparable
 * (qualitative results, results given as "< x", references that are not a plain interval). A comparison, not a diagnosis.
 */
fun LabValue.outOfRange(): Int {
    if (Regex("^[<>≤≥]").containsMatchIn(value.trim())) return 0
    val v = value.trim().replace(',', '.').toDoubleOrNull() ?: return 0
    val r = reference.trim().replace(',', '.').replace('–', '-')
    Regex("^(-?\\d+(?:\\.\\d+)?)\\s*-\\s*(-?\\d+(?:\\.\\d+)?)$").matchEntire(r)?.let { m ->
        val lo = m.groupValues[1].toDouble(); val hi = m.groupValues[2].toDouble()
        return if (v < lo) -1 else if (v > hi) 1 else 0
    }
    Regex("^([<>≤≥])\\s*(\\d+(?:\\.\\d+)?)$").matchEntire(r)?.let { m ->
        val x = m.groupValues[2].toDouble()
        return when (m.groupValues[1]) { "<" -> if (v >= x) 1 else 0; "≤" -> if (v > x) 1 else 0; ">" -> if (v <= x) -1 else 0; else -> if (v < x) -1 else 0 }
    }
    return 0
}

/** A printed test name without case, accents or punctuation, so the same name from two laboratories is one row. */
fun labNameKey(name: String): String = java.text.Normalizer.normalize(name, java.text.Normalizer.Form.NFD)
    .replace(Regex("\\p{M}+"), "").lowercase().replace(Regex("[^a-z0-9%]+"), " ").trim()
