package ch.personalhealthy.app

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.Canvas
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.text.PDFTextStripper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.coroutines.suspendCoroutine
import kotlinx.coroutines.ensureActive
import kotlin.coroutines.coroutineContext
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.time.LocalDate
import java.time.ZoneId
import java.util.UUID
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

// The allowlist prevents patient headings or arbitrary OCR text being sent as a test name.
data class LabDefinition(val code: String, val name: String, val aliases: List<String>)
val labDefinitions = listOf(
    LabDefinition("wbc", "Globuli bianchi", listOf("globuli bianchi", "leucociti", "wbc", "white blood cells", "white blood cells", "globuli bianchi", "leukozyten", "leucocytes")),
    LabDefinition("rbc", "Globuli rossi", listOf("globuli rossi", "eritrociti", "rbc", "red blood cells", "globuli rossi", "erythrozyten", "hématies")),
    LabDefinition("hgb", "Emoglobina", listOf("emoglobina", "hemoglobin", "hgb", "hb", "hemoglobin", "emoglobina", "hämoglobin", "hémoglobine")),
    LabDefinition("hct", "Ematocrito", listOf("ematocrito", "hematocrit", "hct", "hematocrit", "ematocrito", "hämatokrit", "hématocrite")),
    LabDefinition("plt", "Piastrine", listOf("piastrine", "platelets", "plt", "platelets", "piastrine", "thrombozyten", "plaquettes")),
    LabDefinition("mcv", "MCV", listOf("mcv", "mcv", "mcv", "mcv", "vgm")), LabDefinition("mch", "MCH", listOf("mch", "mch", "mch", "mch", "tcmh")),
    LabDefinition("mchc", "MCHC", listOf("mchc", "mchc", "mchc", "mchc", "ccmh")),
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
    LabDefinition("vitamin_d", "Vitamina D", listOf("vitamina d", "vitamin d", "25-oh vitamina d", "vitamin d", "vitamina d", "vitamin d", "vitamine d")),
    LabDefinition("b12", "Vitamina B12", listOf("vitamina b12", "vitamin b12", "vitamin b12", "vitamina b12", "vitamin b12", "vitamine b12"))
)
data class LabValue(val code: String, val value: String, val unit: String, val reference: String) {
    fun json() = JSONObject().put("code", code).put("value", value).put("unit", unit).put("reference", reference)
    val name: String get() = when (code) {
        "wbc" -> t(R.string.lab_name_wbc)
        "rbc" -> t(R.string.lab_name_rbc)
        "hgb" -> t(R.string.lab_name_hgb)
        "hct" -> t(R.string.lab_name_hct)
        "plt" -> t(R.string.lab_name_plt)
        "mcv" -> t(R.string.lab_name_mcv)
        "mch" -> t(R.string.lab_name_mch)
        "mchc" -> t(R.string.lab_name_mchc)
        "glucose" -> t(R.string.lab_name_glucose)
        "creatinine" -> t(R.string.lab_name_creatinine)
        "urea" -> t(R.string.lab_name_urea)
        "uric" -> t(R.string.lab_name_uric)
        "cholesterol" -> t(R.string.lab_name_cholesterol)
        "hdl" -> t(R.string.lab_name_hdl)
        "ldl" -> t(R.string.lab_name_ldl)
        "triglycerides" -> t(R.string.lab_name_triglycerides)
        "ast" -> t(R.string.lab_name_ast)
        "alt" -> t(R.string.lab_name_alt)
        "ggt" -> t(R.string.lab_name_ggt)
        "alp" -> t(R.string.lab_name_alp)
        "bilirubin" -> t(R.string.lab_name_bilirubin)
        "lipase" -> t(R.string.lab_name_lipase)
        "amylase" -> t(R.string.lab_name_amylase)
        "tsh" -> t(R.string.lab_name_tsh)
        "ft3" -> t(R.string.lab_name_ft3)
        "ft4" -> t(R.string.lab_name_ft4)
        "ferritin" -> t(R.string.lab_name_ferritin)
        "iron" -> t(R.string.lab_name_iron)
        "crp" -> t(R.string.lab_name_crp)
        "sodium" -> t(R.string.lab_name_sodium)
        "potassium" -> t(R.string.lab_name_potassium)
        "calcium" -> t(R.string.lab_name_calcium)
        "hba1c" -> t(R.string.lab_name_hba1c)
        "vitamin_d" -> t(R.string.lab_name_vitamin_d)
        "b12" -> t(R.string.lab_name_b12)
        else -> error("unknown_lab")
    }
}
data class LabReport(val id: String, val t: Long, val values: List<LabValue>)
private val labNumber = Regex("[<>≤≥]?\\s*-?\\d{1,9}(?:[.,]\\d{1,8})?")
private val labUnit = Regex("(?:10\\^[369]|10\\^12)/(?:L|[µμu]L)|(?:[µμu]?mol|mmol|nmol|pmol|mIU|[µμu]IU|IU|U|ng|pg|[µμu]g|mg|g)/(?:dL|mL|L)|mmol/mol|fL|pg|%", RegexOption.IGNORE_CASE)
private fun normalizeUnit(s: String): String = s.replace('μ', 'µ').replace("uL", "µL").replace("ug", "µg").replace("umol", "µmol").replace("uIU", "µIU")
fun parseLabLines(text: String): List<LabValue> {
    return text.lineSequence().mapNotNull { line ->
        // Match only rows that START with a recognized test, not an arbitrary heading containing a name.
        val pair = labDefinitions.flatMap { d -> d.aliases.map { d to it } }.sortedByDescending { it.second.length }
            .firstOrNull { (_, a) -> Regex("^\\s*" + Regex.escape(a) + "(?=\\s|[:(]|$)", RegexOption.IGNORE_CASE).containsMatchIn(line) } ?: return@mapNotNull null
        val rest = line.trimStart().substring(pair.second.length).trimStart(' ', ':', '\t')
        val value = labNumber.find(rest)?.takeIf { it.range.first <= 4 } ?: return@mapNotNull null
        val tail = rest.substring(value.range.last + 1)
        val unit = labUnit.find(tail) ?: return@mapNotNull null // Do not guess missing units or column order.
        val refText = tail.substring(unit.range.last + 1).trim().trimStart('*', ' ')
        val ref = Regex("^(?:[<>≤≥]\\s*\\d+(?:[.,]\\d+)?|\\d+(?:[.,]\\d+)?\\s*[-–]\\s*\\d+(?:[.,]\\d+)?)").find(refText)?.value ?: ""
        val normalized = normalizeUnit(unit.value)
        val canonical = listOf("%", "g/dL", "g/L", "mg/dL", "mg/L", "mmol/L", "µmol/L", "U/L", "IU/L", "mIU/L", "µIU/mL", "ng/mL", "pg/mL", "µg/dL", "µg/L", "fL", "pg", "10^9/L", "10^12/L", "10^3/µL", "10^6/µL", "mmol/mol", "pmol/L", "nmol/L").firstOrNull { it.equals(normalized, ignoreCase = true) } ?: return@mapNotNull null
        LabValue(pair.first.code, value.value.trim(), canonical, ref)
    }.toList().groupBy { it.code }.filterValues { it.size == 1 }.values.map { it.single() }
}

object LabDocuments {
    private suspend fun recognize(bitmap: Bitmap): String {
        val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        return try {
            suspendCoroutine { cont ->
                recognizer.process(InputImage.fromBitmap(bitmap, 0))
                    .addOnSuccessListener { result ->
                        val lines = result.textBlocks.flatMap { it.lines }.sortedWith(compareBy({ it.boundingBox?.top ?: 0 }, { it.boundingBox?.left ?: 0 }))
                        // Merge columns at the same baseline, rather than returning column-major text.
                        val groups = mutableListOf<MutableList<com.google.mlkit.vision.text.Text.Line>>()
                        for (line in lines) {
                            val top = line.boundingBox?.centerY() ?: 0
                            val group = groups.lastOrNull()
                            if (group != null && kotlin.math.abs(top - (group.first().boundingBox?.centerY() ?: 0)) < (line.boundingBox?.height() ?: 12) / 2)
                                group.add(line) else groups.add(mutableListOf(line))
                        }
                        cont.resume(groups.joinToString("\n") { g -> g.sortedBy { it.boundingBox?.left }.joinToString(" ") { it.text } })
                    }
                    .addOnFailureListener { cont.resumeWithException(it) }
            }
        } finally { recognizer.close() }
    }
    suspend fun extract(ctx: Context, uri: Uri): List<LabValue> = withContext(Dispatchers.IO) {
        // A private, short-lived file is needed by PdfRenderer. Never keep source filenames or URI permissions.
        val file = File.createTempFile("lab-", ".bin", ctx.cacheDir)
        try {
            ctx.contentResolver.openInputStream(uri)?.use { input -> file.outputStream().use { out ->
                val buf = ByteArray(8192); var total = 0
                while (true) { val n = input.read(buf); if (n < 0) break; total += n
                    require(total <= 20 * 1024 * 1024) { "document_too_large" }; out.write(buf, 0, n) }
            } } ?: error("document_unavailable")
            val pdf = file.inputStream().use { ByteArray(5).also { b -> it.read(b) }.toString(Charsets.US_ASCII) } == "%PDF-"
            val text = if (pdf) {
                PDFBoxResourceLoader.init(ctx)
                val pages = PDDocument.load(file).use { doc ->
                    require(!doc.isEncrypted && doc.numberOfPages in 1..15) { "document_unsupported" }
                    (1..doc.numberOfPages).map { i -> PDFTextStripper().apply { sortByPosition = true; startPage = i; endPage = i }.getText(doc) }
                }
                // Fall back page by page so hybrid PDFs are not silently truncated.
                ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY).use { fd -> PdfRenderer(fd).use { renderer ->
                    pages.mapIndexed { i, embedded ->
                        coroutineContext.ensureActive()
                        if (parseLabLines(embedded).isNotEmpty()) embedded else renderer.openPage(i).use { page ->
                            val scale = minOf(2.5f, 2400f / maxOf(page.width, page.height))
                            val bitmap = Bitmap.createBitmap((page.width * scale).toInt().coerceAtLeast(1), (page.height * scale).toInt().coerceAtLeast(1), Bitmap.Config.ARGB_8888)
                            try { bitmap.eraseColor(android.graphics.Color.WHITE); page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY); recognize(bitmap) }
                            finally { bitmap.recycle() }
                        }
                    }.joinToString("\n")
                } }
            } else {
                val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                BitmapFactory.decodeFile(file.path, bounds)
                require(bounds.outWidth > 0 && bounds.outHeight > 0) { "document_unsupported" }
                var sample = 1
                while (maxOf(bounds.outWidth, bounds.outHeight) / sample > 3000) sample *= 2
                val bitmap = BitmapFactory.decodeFile(file.path, BitmapFactory.Options().apply { inSampleSize = sample }) ?: error("document_unsupported")
                try { recognize(bitmap) } finally { bitmap.recycle() }
            }
            parseLabLines(text) // Raw text and patient headings never leave this function.
        } finally { file.delete() }
    }
}
object LabsRepo {
    suspend fun list(pid: String): List<LabReport> {
        val rows = Api.call("GET", "/v1/labs", null, pid).getJSONArray("items")
        return (0 until rows.length()).map { i -> val r = rows.getJSONObject(i); val xs = r.getJSONArray("items")
            LabReport(r.getString("id"), r.getLong("t"), (0 until xs.length()).map { j -> val x = xs.getJSONObject(j)
                LabValue(x.getString("code"), x.getString("value"), x.getString("unit"), x.getString("reference")) }) }
    }
    suspend fun save(pid: String, id: String, date: LocalDate, values: List<LabValue>) {
        val t = date.atStartOfDay(ZoneId.of("Europe/Zurich")).toInstant().toEpochMilli()
        Api.call("POST", "/v1/labs", JSONObject().put("id", id).put("takenAt", t).put("confirmed", true).put("items", JSONArray(values.map { it.json() })), pid)
    }
    suspend fun delete(pid: String, id: String) { Api.call("DELETE", "/v1/labs/$id", null, pid) }
}

@Composable
fun LabsScreen(pid: String) {
    val ctx = LocalContext.current; val scope = rememberCoroutineScope()
    var reports by remember(pid) { mutableStateOf<List<LabReport>>(emptyList()) }
    var draft by remember(pid) { mutableStateOf<List<LabValue>>(emptyList()) }
    var date by remember(pid) { mutableStateOf("") }
    var importId by remember(pid) { mutableStateOf(UUID.randomUUID().toString()) }
    var busy by remember(pid) { mutableStateOf(false) }
    var message by remember(pid) { mutableStateOf<String?>(null) }
    var checked by remember(pid) { mutableStateOf(false) }
    suspend fun refresh() { reports = LabsRepo.list(pid) }
    LaunchedEffect(pid) { try { refresh() } catch (_: Exception) { message = t(R.string.labs_network) } }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) scope.launch {
            busy = true; draft = emptyList(); checked = false; message = null; date = ""; importId = UUID.randomUUID().toString()
            try { draft = LabDocuments.extract(ctx, uri); if (draft.isEmpty()) message = t(R.string.labs_no_results) }
            catch (_: Exception) { message = t(R.string.labs_failed) } finally { busy = false }
        }
    }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item {
            Text(t(R.string.tab_labs), color = C.Ink, fontSize = 24.sp, modifier = Modifier.padding(top = 20.dp))
            Panel {
                Text(t(R.string.labs_intro), color = C.Muted, fontSize = 14.sp)
                Spacer(Modifier.height(12.dp))
                BigButton(t(if (busy) R.string.labs_working else R.string.labs_import), enabled = !busy) { picker.launch(arrayOf("application/pdf", "image/jpeg", "image/png")) }
                Text(t(R.string.labs_privacy), color = C.Muted, fontSize = 14.sp, modifier = Modifier.padding(top = 12.dp))
            }
            message?.let { Text(it, color = C.Ink, fontSize = 14.sp) }
        }
        if (draft.isNotEmpty()) {
            item {
                Text(t(R.string.labs_review), color = C.Ink, fontSize = 18.sp)
                Text(t(R.string.labs_partial), color = C.Muted, fontSize = 14.sp)
                BigButton(if (date.isEmpty()) t(R.string.labs_date) else date, color = C.Surface2, textColor = C.Ink, enabled = !busy) {
                    val initial = runCatching { LocalDate.parse(date) }.getOrElse { LocalDate.now(ZoneId.of("Europe/Zurich")) }
                    android.app.DatePickerDialog(ctx, { _, y, m, d -> date = LocalDate.of(y, m + 1, d).toString(); checked = false }, initial.year, initial.monthValue - 1, initial.dayOfMonth).apply {
                        datePicker.maxDate = System.currentTimeMillis()
                        datePicker.minDate = System.currentTimeMillis() - 364L * 86400000L
                    }.show()
                }
            }
            items(draft, key = { it.code }) { value ->
                Panel {
                    Text(value.name, color = C.Ink, fontSize = 18.sp)
                    OutlinedTextField(value.value, { next -> draft = draft.map { if (it.code == value.code) it.copy(value = next) else it }; checked = false }, label = { Text(t(R.string.labs_value)) }, singleLine = true)
                    OutlinedTextField(value.unit, { next -> draft = draft.map { if (it.code == value.code) it.copy(unit = next) else it }; checked = false }, label = { Text(t(R.string.labs_unit)) }, singleLine = true)
                    OutlinedTextField(value.reference, { next -> draft = draft.map { if (it.code == value.code) it.copy(reference = next) else it }; checked = false }, label = { Text(t(R.string.labs_reference)) }, singleLine = true)
                    TextButton(onClick = { draft = draft.filter { it.code != value.code }; checked = false }) { Text(t(R.string.delete)) }
                }
            }
            item {
                Row { Checkbox(checked, { checked = it }); Text(t(R.string.labs_confirm), color = C.Ink, fontSize = 14.sp) }
                BigButton(t(R.string.labs_save), enabled = checked && !busy) {
                    scope.launch { busy = true
                        try { val d = LocalDate.parse(date); require(!d.isAfter(LocalDate.now(ZoneId.of("Europe/Zurich"))) && d.isAfter(LocalDate.now(ZoneId.of("Europe/Zurich")).minusDays(365)))
                            LabsRepo.save(pid, importId, d, draft); draft = emptyList(); checked = false; message = t(R.string.labs_saved); refresh()
                        } catch (_: Exception) { message = t(R.string.labs_check) } finally { busy = false }
                    }
                }
                TextButton(onClick = { draft = emptyList(); checked = false }) { Text(t(R.string.cancel)) }
            }
        }
        item {
            Text(t(R.string.labs_history, reports.size), color = C.Ink, fontSize = 18.sp)
            if (reports.isEmpty()) Panel { Text(t(R.string.labs_empty), color = C.Muted, fontSize = 14.sp) }
        }
        // A dated series per test and unit. Different units are never combined into a trend.
        val series = reports.flatMap { r -> r.values.map { (it.code to it.unit) to (r.t to it) } }.groupBy({ it.first }, { it.second })
        items(series.entries.toList(), key = { it.key.first + ":" + it.key.second }) { entry ->
            Panel {
                Text(entry.value.first().second.name + " · " + entry.key.second, color = C.Ink, fontSize = 18.sp)
                LabTrend(entry.value)
                entry.value.sortedByDescending { it.first }.take(8).forEach { (t0, v) ->
                    Text(java.time.Instant.ofEpochMilli(t0).atZone(ZoneId.of("Europe/Zurich")).toLocalDate().toString() + "   " + v.value + "   [" + v.reference + "]", color = C.Ink, fontSize = 14.sp)
                }
            }
        }
        items(reports.sortedByDescending { it.t }, key = { it.id }) { report ->
            TextButton(onClick = { scope.launch { try { LabsRepo.delete(pid, report.id); refresh() } catch (_: Exception) { message = t(R.string.labs_network) } } }) {
                Text(t(R.string.labs_delete, java.time.Instant.ofEpochMilli(report.t).atZone(ZoneId.of("Europe/Zurich")).toLocalDate().toString()))
            }
        }
        item { Spacer(Modifier.height(24.dp)) }
    }
}

@Composable
private fun LabTrend(values: List<Pair<Long, LabValue>>) {
    val points = values.mapNotNull { (t0, v) -> v.value.replace(',', '.').toDoubleOrNull()?.let { t0 to it } }.sortedBy { it.first }
    if (points.size < 2) return
    val lo = points.minOf { it.second }; val hi = points.maxOf { it.second }; val range = (hi - lo).takeIf { it > 0 } ?: 1.0
    Canvas(Modifier.fillMaxWidth().height(120.dp).padding(vertical = 12.dp)) {
        val t0 = points.first().first; val span = (points.last().first - t0).coerceAtLeast(1)
        val coords = points.map { (t, n) -> Offset(8f + (size.width - 16f) * ((t - t0).toFloat() / span), size.height - 8f - (size.height - 16f) * ((n - lo) / range).toFloat()) }
        val path = Path().apply { coords.forEachIndexed { i, p -> if (i == 0) moveTo(p.x, p.y) else lineTo(p.x, p.y) } }
        drawPath(path, C.Sys, style = Stroke(width = 3f))
        coords.forEach { drawCircle(C.Sys, 5f, it) }
    }
}
