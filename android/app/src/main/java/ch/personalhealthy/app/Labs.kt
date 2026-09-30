package ch.personalhealthy.app

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import androidx.exifinterface.media.ExifInterface
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
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

/** The test name in the phone's language (catalog), or as printed on the report. */
val LabValue.name: String get() = if (code.isEmpty()) label else when (code) {
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
        "rdw" -> t(R.string.lab_name_rdw)
        "rdw_sd" -> t(R.string.lab_name_rdw_sd)
        "mpv" -> t(R.string.lab_name_mpv)
        "psa" -> t(R.string.lab_name_psa)
        "neutrophils" -> t(R.string.lab_name_neutrophils)
        "neutrophils_pct" -> t(R.string.lab_name_neutrophils_pct)
        "lymphocytes" -> t(R.string.lab_name_lymphocytes)
        "lymphocytes_pct" -> t(R.string.lab_name_lymphocytes_pct)
        "monocytes" -> t(R.string.lab_name_monocytes)
        "monocytes_pct" -> t(R.string.lab_name_monocytes_pct)
        "eosinophils" -> t(R.string.lab_name_eosinophils)
        "eosinophils_pct" -> t(R.string.lab_name_eosinophils_pct)
        "basophils" -> t(R.string.lab_name_basophils)
        "basophils_pct" -> t(R.string.lab_name_basophils_pct)
        "urine_culture" -> t(R.string.lab_name_urine_culture)
        else -> error("unknown_lab")
    }

data class LabReport(val id: String, val t: Long, val values: List<LabValue>)
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
    /** Stage 1: a private, short-lived copy (PdfRenderer needs a file) and the file's SHA-256, to recognize it again. */
    suspend fun copy(ctx: Context, uri: Uri): Pair<File, String> = withContext(Dispatchers.IO) {
        // Never keep source filenames or URI permissions.
        val file = File.createTempFile("lab-", ".bin", ctx.cacheDir)
        try {
            val sha = java.security.MessageDigest.getInstance("SHA-256")
            ctx.contentResolver.openInputStream(uri)?.use { input -> file.outputStream().use { out ->
                val buf = ByteArray(8192); var total = 0
                while (true) { val n = input.read(buf); if (n < 0) break; total += n
                    require(total <= 20 * 1024 * 1024) { "document_too_large" }; out.write(buf, 0, n); sha.update(buf, 0, n) }
            } } ?: error("document_unavailable")
            file to sha.digest().joinToString("") { "%02x".format(it) }
        } catch (e: Exception) { file.delete(); throw e }
    }
    /** Stage 2: the text of the document, read on this phone (embedded PDF text, or OCR for scans and photos). */
    suspend fun text(ctx: Context, file: File): String = withContext(Dispatchers.IO) {
        val pdf = file.inputStream().use { ByteArray(5).also { b -> it.read(b) }.toString(Charsets.US_ASCII) } == "%PDF-"
        if (pdf) {
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
            // Honor camera EXIF orientation, including mirrored photos.
            val orientation = runCatching { ExifInterface(file).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL) }.getOrDefault(ExifInterface.ORIENTATION_NORMAL)
            val matrix = Matrix().apply {
                when (orientation) {
                    ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> setScale(-1f, 1f)
                    ExifInterface.ORIENTATION_ROTATE_180 -> setRotate(180f)
                    ExifInterface.ORIENTATION_FLIP_VERTICAL -> setScale(1f, -1f)
                    ExifInterface.ORIENTATION_TRANSPOSE -> { setRotate(90f); postScale(-1f, 1f) }
                    ExifInterface.ORIENTATION_ROTATE_90 -> setRotate(90f)
                    ExifInterface.ORIENTATION_TRANSVERSE -> { setRotate(-90f); postScale(-1f, 1f) }
                    ExifInterface.ORIENTATION_ROTATE_270 -> setRotate(-90f)
                }
            }
            val oriented = if (matrix.isIdentity) bitmap else Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
            try { recognize(oriented) } finally { if (oriented !== bitmap) oriented.recycle(); bitmap.recycle() }
        }
    }
}
object LabsRepo {
    suspend fun list(pid: String): List<LabReport> {
        val rows = Api.call("GET", "/v1/labs", null, pid).getJSONArray("items")
        return (0 until rows.length()).map { i -> val r = rows.getJSONObject(i); val xs = r.getJSONArray("items")
            LabReport(r.getString("id"), r.getLong("t"), (0 until xs.length()).map { j -> val x = xs.getJSONObject(j)
                LabValue(x.getString("code"), x.getString("value"), x.getString("unit"), x.getString("reference"), if (x.getString("code").isEmpty()) x.optString("name") else "") }) }
    }
    /** The whole report in one request: the server saves all of it or nothing, and recognizes the same file or day. */
    suspend fun save(pid: String, id: String, date: LocalDate, values: List<LabValue>, fileHash: String): JSONObject {
        val t = date.atStartOfDay(ZoneId.of("Europe/Zurich")).toInstant().toEpochMilli()
        return Api.call("POST", "/v1/labs", JSONObject().put("id", id).put("takenAt", t).put("auto", true).put("fileHash", fileHash)
            .put("items", JSONArray(values.map { it.json() })), pid)
    }
    suspend fun delete(pid: String, id: String) { Api.call("DELETE", "/v1/labs/$id", null, pid) }
}

/**
 * The import runs in the background, outside the screen: leaving the tab does not stop it, and the status is there
 * when you come back. Each stage is shown when the work really reaches it, and stays at least a moment on screen so
 * the progress can be followed. Done only after the server confirmed the save; any doubt ends in Failed, nothing saved.
 */
object LabImport {
    enum class Stage { IDLE, READING, SCANNING, UPLOADING, DONE, FAILED }
    data class Status(val stage: Stage = Stage.IDLE, val text: String = "")
    val status = kotlinx.coroutines.flow.MutableStateFlow(Status())
    private val scope = kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.SupervisorJob() + Dispatchers.Default)
    private var job: kotlinx.coroutines.Job? = null
    private var shownAt = 0L
    val busy: Boolean get() = job?.isActive == true
    private val zurich = ZoneId.of("Europe/Zurich")
    private fun day(d: LocalDate) = d.format(java.time.format.DateTimeFormatter.ofPattern("dd.MM.yyyy"))

    private suspend fun show(stage: Stage, text: String) {
        val wait = 900L - (System.currentTimeMillis() - shownAt)
        if (status.value.stage in listOf(Stage.READING, Stage.SCANNING, Stage.UPLOADING) && wait > 0) kotlinx.coroutines.delay(wait)
        status.value = Status(stage, text); shownAt = System.currentTimeMillis()
    }
    private suspend fun fail(code: String, text: String) {
        ErrorReport.send(code, "Labs/Import", "")    // the reason only: never a value, a name or the document
        show(Stage.FAILED, text)
    }

    fun start(ctx: Context, pid: String, uri: Uri, onSaved: () -> Unit) {
        if (busy) return
        val app = ctx.applicationContext
        shownAt = 0L
        job = scope.launch {
            var file: File? = null
            try {
                show(Stage.READING, t(R.string.labs_step_read))
                val (f, sha) = LabDocuments.copy(app, uri); file = f
                show(Stage.SCANNING, t(R.string.labs_step_scan))
                val read = readLabText(LabDocuments.text(app, f), LocalDate.now(zurich))
                f.delete(); file = null
                if (read is LabRead.Failed) {
                    fail("lab_" + read.reason, when (read.reason) {
                        "unreadable_rows" -> t(R.string.labs_fail_unreadable, read.count)
                        "no_date", "ambiguous_date" -> t(R.string.labs_fail_date)
                        "future_date" -> t(R.string.labs_fail_future)
                        "duplicate_tests" -> t(R.string.labs_fail_duplicate_tests)
                        else -> t(R.string.labs_no_results)
                    }); return@launch
                }
                read as LabRead.Ok
                show(Stage.UPLOADING, t(R.string.labs_step_upload))
                val r = LabsRepo.save(pid, UUID.randomUUID().toString(), read.date, read.values, sha)
                if (r.has("duplicate")) show(Stage.DONE, t(R.string.labs_duplicate, day(read.date)))
                else {
                    val known = r.optInt("known", 0)
                    show(Stage.DONE, t(R.string.labs_done, day(read.date), r.optInt("saved", read.values.size)) + if (known > 0) " " + t(R.string.labs_done_known, known) else "")
                }
                onSaved()
            } catch (e: kotlinx.coroutines.CancellationException) { throw e
            } catch (e: ApiException) {
                show(Stage.FAILED, if (e.code == "lab_conflict_values") t(R.string.labs_fail_conflict) else e.message ?: t(R.string.labs_network))
            } catch (e: Exception) {
                val unsupported = e.message == "document_unsupported"
                fail(if (unsupported) "lab_unsupported" else "import_failed", t(if (unsupported) R.string.labs_format_unsupported else if (e is java.io.IOException) R.string.labs_network else R.string.labs_failed))
            } finally { file?.delete() }
        }
    }
    fun clear() { if (!busy) status.value = Status() }
}

@Composable
fun LabsScreen(pid: String) {
    val ctx = LocalContext.current; val scope = rememberCoroutineScope()
    var reports by remember(pid) { mutableStateOf<List<LabReport>>(emptyList()) }
    var message by remember(pid) { mutableStateOf<String?>(null) }
    var open by remember(pid) { mutableStateOf<String?>(null) }
    val status by LabImport.status.collectAsState()
    suspend fun refresh() { reports = LabsRepo.list(pid) }
    LaunchedEffect(pid) { try { refresh() } catch (_: Exception) { message = t(R.string.labs_network) } }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) LabImport.start(ctx, pid, uri) { scope.launch { try { refresh() } catch (_: Exception) { } } }
    }
    val working = status.stage in listOf(LabImport.Stage.READING, LabImport.Stage.SCANNING, LabImport.Stage.UPLOADING)
    val fmt = java.time.format.DateTimeFormatter.ofPattern("dd.MM.yyyy")
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item {
            Text(t(R.string.tab_labs), color = C.Ink, fontSize = 24.sp, modifier = Modifier.padding(top = 20.dp))
            Panel {
                Text(t(R.string.labs_intro), color = C.Muted, fontSize = 14.sp)
                Spacer(Modifier.height(12.dp))
                // PDF and photos only; any other kind of file cannot be picked
                BigButton(t(R.string.labs_import), enabled = !working) { LabImport.clear(); picker.launch(arrayOf("application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif")) }
                Text(t(R.string.labs_privacy), color = C.Muted, fontSize = 13.sp, modifier = Modifier.padding(top = 10.dp))
            }
            if (status.stage != LabImport.Stage.IDLE) ImportProgress(status)
            message?.let { Text(it, color = C.Ink, fontSize = 14.sp) }
        }
        item {
            Text(t(R.string.labs_history, reports.size), color = C.Ink, fontSize = 18.sp, modifier = Modifier.padding(top = 8.dp))
            Panel { Text(if (reports.isEmpty()) t(R.string.labs_empty) else t(R.string.labs_web_hint), color = C.Muted, fontSize = 14.sp) }
        }
        items(reports.sortedByDescending { it.t }, key = { it.id }) { report ->
            val date = java.time.Instant.ofEpochMilli(report.t).atZone(ZoneId.of("Europe/Zurich")).toLocalDate().format(fmt)
            Panel {
                TextButton(onClick = { open = if (open == report.id) null else report.id }, contentPadding = PaddingValues(0.dp)) {
                    Text(t(R.string.labs_report_row, date, report.values.size), color = C.Ink, fontSize = 16.sp)
                }
                if (open == report.id) {
                    report.values.forEach { v ->
                        val out = v.outOfRange()
                        Row(Modifier.fillMaxWidth().padding(vertical = 3.dp)) {
                            Text(v.name + if (v.unit.isNotEmpty()) " · " + v.unit else "", color = C.Muted, fontSize = 13.sp, modifier = Modifier.weight(1f))
                            Text(v.value + when (out) { 1 -> " ↑"; -1 -> " ↓"; else -> "" } + if (v.reference.isNotEmpty()) "   (" + v.reference + ")" else "",
                                color = if (out != 0) C.Out else C.Ink, fontSize = 13.sp)
                        }
                    }
                    TextButton(onClick = { scope.launch { try { LabsRepo.delete(pid, report.id); refresh() } catch (_: Exception) { message = t(R.string.labs_network) } } }) {
                        Text(t(R.string.labs_delete, date), color = C.Muted)
                    }
                }
            }
        }
        item { Spacer(Modifier.height(24.dp)) }
    }
}

/** Three steps with the current one turning, then the outcome. Never a red: a failure is said in words. */
@Composable
private fun ImportProgress(status: LabImport.Status) {
    val order = listOf(LabImport.Stage.READING, LabImport.Stage.SCANNING, LabImport.Stage.UPLOADING)
    val labels = listOf(t(R.string.labs_short_read), t(R.string.labs_short_scan), t(R.string.labs_short_upload))
    val at = order.indexOf(status.stage).let { if (status.stage == LabImport.Stage.DONE) 3 else it }
    Panel {
        if (status.stage != LabImport.Stage.FAILED) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            labels.forEachIndexed { i, label ->
                Column(horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally, modifier = Modifier.weight(1f)) {
                    Box(Modifier.size(28.dp), contentAlignment = androidx.compose.ui.Alignment.Center) {
                        when {
                            i < at -> Text("✓", color = C.Dia, fontSize = 20.sp)
                            i == at -> CircularProgressIndicator(Modifier.size(24.dp), color = C.Sys, strokeWidth = 3.dp)
                            else -> Text("•", color = C.Muted, fontSize = 20.sp)
                        }
                    }
                    Text(label, color = if (i <= at) C.Ink else C.Muted, fontSize = 12.sp)
                }
            }
        }
        Spacer(Modifier.height(10.dp))
        Text(status.text, color = C.Ink, fontSize = 15.sp)
    }
}
