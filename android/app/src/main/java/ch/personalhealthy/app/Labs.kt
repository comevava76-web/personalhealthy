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
import androidx.compose.animation.core.animateFloat
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
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

/** t: the date printed on the report; at: when it was uploaded. */
data class LabReport(val id: String, val t: Long, val values: List<LabValue>, val at: Long = t)

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
                LabValue(x.getString("code"), x.getString("value"), x.getString("unit"), x.getString("reference"), if (x.getString("code").isEmpty()) x.optString("name") else "") },
                r.optLong("c", r.getLong("t"))) }
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
    /** step: the stage reached (0 processing, 1 scanning, 2 uploading), kept on a failure to show where it stopped. */
    data class Status(val stage: Stage = Stage.IDLE, val text: String = "", val step: Int = 0)
    val status = kotlinx.coroutines.flow.MutableStateFlow(Status())
    private val scope = kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.SupervisorJob() + Dispatchers.Default)
    private var job: kotlinx.coroutines.Job? = null
    private var shownAt = 0L
    val busy: Boolean get() = job?.isActive == true
    private val zurich = ZoneId.of("Europe/Zurich")
    private fun day(d: LocalDate) = d.format(java.time.format.DateTimeFormatter.ofPattern("dd.MM.yyyy"))
    private val working = listOf(Stage.READING, Stage.SCANNING, Stage.UPLOADING)

    private suspend fun show(stage: Stage, text: String) {
        val wait = 900L - (System.currentTimeMillis() - shownAt)
        if (status.value.stage in working && wait > 0) kotlinx.coroutines.delay(wait)
        val step = working.indexOf(stage).let { if (it >= 0) it else status.value.step }
        val next = Status(stage, text, step)
        status.value = next; shownAt = System.currentTimeMillis()
        // the outcome stays a few seconds, then the progress card goes away
        if (stage == Stage.DONE || stage == Stage.FAILED) scope.launch {
            kotlinx.coroutines.delay(if (stage == Stage.DONE) 3500L else 6000L)
            status.compareAndSet(next, Status())
        }
    }
    private suspend fun fail(ctx: Context, code: String, outcome: String, date: LocalDate?, text: String, report: Boolean = true) {
        // in the application logs only (the reason, never a value, a name or the document); the server counts the
        // duplicates and conflicts itself. The history in the app shows saved reports only.
        if (report) ErrorReport.send(code, "Labs/Import", "")
        show(Stage.FAILED, text)
    }

    fun start(ctx: Context, pid: String, uri: Uri, onSaved: () -> Unit) {
        if (busy) return
        val app = ctx.applicationContext
        shownAt = 0L
        job = scope.launch {
            var file: File? = null
            var date: LocalDate? = null
            try {
                show(Stage.READING, t(R.string.labs_step_read))
                val (f, sha) = LabDocuments.copy(app, uri); file = f
                show(Stage.SCANNING, t(R.string.labs_step_scan))
                val read = readLabText(LabDocuments.text(app, f), LocalDate.now(zurich))
                f.delete(); file = null
                if (read is LabRead.Failed) {
                    val outcome = when (read.reason) {
                        "unreadable_rows" -> "unreadable"
                        "no_date", "ambiguous_date", "future_date" -> "date"
                        "duplicate_tests" -> "duplicate_tests"
                        else -> "no_results"
                    }
                    fail(app, "lab_" + read.reason, outcome, null, when (read.reason) {
                        "unreadable_rows" -> t(R.string.labs_fail_unreadable, read.count)
                        "no_date", "ambiguous_date" -> t(R.string.labs_fail_date)
                        "future_date" -> t(R.string.labs_fail_future)
                        "duplicate_tests" -> t(R.string.labs_fail_duplicate_tests)
                        else -> t(R.string.labs_no_results)
                    }); return@launch
                }
                read as LabRead.Ok
                date = read.date
                show(Stage.UPLOADING, t(R.string.labs_step_upload))
                val r = LabsRepo.save(pid, UUID.randomUUID().toString(), read.date, read.values, sha)
                if (r.has("duplicate")) {
                    // not an error: the same file, or the same results of that day, are already in the history
                    show(Stage.DONE, t(R.string.labs_duplicate, day(read.date)))
                } else {
                    val known = r.optInt("known", 0)
                    show(Stage.DONE, t(R.string.labs_done, day(read.date), r.optInt("saved", read.values.size)) + if (known > 0) " " + t(R.string.labs_done_known, known) else "")
                }
                onSaved()
            } catch (e: kotlinx.coroutines.CancellationException) { throw e
            } catch (e: ApiException) {
                val conflict = e.code == "lab_conflict_values"
                fail(app, e.code, if (conflict) "conflict" else "failed", date, if (conflict) t(R.string.labs_fail_conflict) else e.message ?: t(R.string.labs_network), report = false)
            } catch (e: Exception) {
                val unsupported = e.message == "document_unsupported"
                fail(app, if (unsupported) "lab_unsupported" else "import_failed", if (unsupported) "format" else "failed", date,
                    t(if (unsupported) R.string.labs_format_unsupported else if (e is java.io.IOException) R.string.labs_network else R.string.labs_failed))
            } finally { file?.delete() }
        }
    }
    fun clear() { if (!busy) status.value = Status() }
}

/** One line of the upload history: a report saved on the server. */
private data class Upload(val at: Long, val date: LocalDate?, val outcome: String, val count: Int = 0, val id: String? = null)

@Composable
fun LabsScreen(pid: String, onDash: () -> Unit) {
    val ctx = LocalContext.current; val scope = rememberCoroutineScope()
    var reports by remember(pid) { mutableStateOf<List<LabReport>>(emptyList()) }
    var message by remember(pid) { mutableStateOf<String?>(null) }
    var ask by remember(pid) { mutableStateOf<Upload?>(null) }
    var open by remember(pid) { mutableStateOf(false) }   // the saved reports: closed under their number until tapped
    val status by LabImport.status.collectAsState()
    suspend fun refresh() { reports = LabsRepo.list(pid); message = null }
    LaunchedEffect(pid) { try { refresh() } catch (_: Exception) { message = t(R.string.labs_network) } }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) LabImport.start(ctx, pid, uri) { scope.launch { try { refresh() } catch (_: Exception) { } } }
    }
    val working = status.stage in listOf(LabImport.Stage.READING, LabImport.Stage.SCANNING, LabImport.Stage.UPLOADING)
    val zurich = ZoneId.of("Europe/Zurich")
    val fmt = java.time.format.DateTimeFormatter.ofPattern("dd.MM.yyyy")
    // the history: the reports saved, by upload day (a refused or duplicate upload is only in the application logs)
    val uploads = remember(reports) {
        reports.map { Upload(it.at, java.time.Instant.ofEpochMilli(it.t).atZone(zurich).toLocalDate(), "saved", it.values.size, it.id) }.sortedByDescending { it.at }
    }
    val byDay = uploads.groupBy { java.time.Instant.ofEpochMilli(it.at).atZone(zurich).toLocalDate() }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = 18.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        item {
            Header(t(R.string.tab_labs))
            Panel {
                Text(t(R.string.labs_intro), color = C.Muted, fontSize = 14.sp)
                Spacer(Modifier.height(8.dp))
                // PDF and photos only; any other kind of file cannot be picked
                BigButton(t(R.string.labs_import), enabled = !working, icon = R.drawable.ic_tab_labs) {
                    LabImport.clear(); picker.launch(arrayOf("application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"))
                }
                // one account, one person: the server cannot tell whose report it is (terms of use, v18)
                Text(t(R.string.labs_own), color = C.Ink, fontSize = 13.sp, modifier = Modifier.padding(top = 6.dp))
                Text(t(R.string.labs_privacy), color = C.Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
            }
            androidx.compose.animation.AnimatedVisibility(
                visible = status.stage != LabImport.Stage.IDLE,
                enter = androidx.compose.animation.fadeIn() + androidx.compose.animation.expandVertically(),
                exit = androidx.compose.animation.fadeOut() + androidx.compose.animation.shrinkVertically()
            ) { ImportProgress(status) }
            message?.let { Panel { Text(it, color = C.Alert, fontSize = 14.sp) } }
            Text(t(R.string.labs_uploads), color = C.Ink, fontSize = 18.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold,
                modifier = Modifier.padding(top = 14.dp, start = 4.dp))
            if (uploads.isEmpty()) Text(t(R.string.labs_empty), color = C.Muted, fontSize = 13.sp,
                modifier = Modifier.padding(start = 4.dp, end = 4.dp, bottom = 4.dp))
            // one line with the number of saved reports; a tap opens the list (and closes it again)
            if (uploads.isNotEmpty()) Row(
                Modifier.fillMaxWidth().padding(vertical = 5.dp).clip(RoundedCornerShape(22.dp)).background(C.Surface)
                    .border(1.dp, C.Line, RoundedCornerShape(22.dp)).clickable { open = !open }.padding(horizontal = 18.dp, vertical = 14.dp),
                verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
            ) {
                Box(Modifier.size(38.dp).clip(androidx.compose.foundation.shape.CircleShape).background(C.Dia.copy(alpha = 0.16f)),
                    contentAlignment = androidx.compose.ui.Alignment.Center) {
                    Text("${uploads.size}", color = C.Dia, fontSize = 16.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)
                }
                Spacer(Modifier.width(12.dp))
                Text(t(R.string.db_labs_count, uploads.size), color = C.Ink, fontSize = 15.sp, modifier = Modifier.weight(1f))
                Text(if (open) "⌃" else "⌄", color = C.Muted, fontSize = 20.sp)
            }
        }
        if (open) byDay.forEach { (d, list) ->
            item(key = "d" + d.toEpochDay()) {
                Panel {
                    Text(if (d == LocalDate.now(zurich)) t(R.string.labs_today) + " · " + d.format(fmt) else d.format(fmt),
                        color = C.Muted, fontSize = 13.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold)
                    list.forEachIndexed { i, u ->
                        if (i > 0) Box(Modifier.fillMaxWidth().height(1.dp).background(C.Line))
                        UploadRow(u, fmt) { ask = u }
                    }
                }
            }
        }
        item {
            Spacer(Modifier.height(6.dp))
            GlowButton(t(R.string.my_dash) + "  ↗", onClick = onDash)
            Spacer(Modifier.height(24.dp))
        }
    }
    // deleting a saved report: always asked first; the file can then be imported again
    ask?.let { u ->
        val date = u.date?.format(fmt) ?: ""
        AlertDialog(
            onDismissRequest = { ask = null },
            title = { Text(t(R.string.labs_delete, date)) },
            text = { Text(t(R.string.labs_delete_q)) },
            confirmButton = { TextButton(onClick = {
                ask = null
                scope.launch { try { LabsRepo.delete(pid, u.id ?: return@launch); refresh() } catch (_: Exception) { message = t(R.string.labs_network) } }
            }) { Text(t(R.string.delete)) } },
            dismissButton = { TextButton(onClick = { ask = null }) { Text(t(R.string.cancel)) } },
            containerColor = C.Surface
        )
    }
}

/** A dot, the report date, the outcome; never the results themselves (they are in the Web Dashboard). */
@Composable
private fun UploadRow(u: Upload, fmt: java.time.format.DateTimeFormatter, onDelete: () -> Unit) {
    val ok = u.outcome == "saved"
    val tint = when (u.outcome) { "saved" -> C.Dia; "duplicate" -> C.Muted; else -> C.Alert }
    Row(Modifier.fillMaxWidth().padding(vertical = 10.dp), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
        Box(Modifier.size(30.dp).clip(androidx.compose.foundation.shape.CircleShape).background(tint.copy(alpha = 0.18f)),
            contentAlignment = androidx.compose.ui.Alignment.Center) {
            Text(when (u.outcome) { "saved" -> "✓"; "duplicate" -> "="; else -> "!" }, color = tint, fontSize = 15.sp,
                fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(u.date?.let { t(R.string.labs_upload_report, it.format(fmt)) } ?: t(R.string.labs_upload_nodate), color = C.Ink, fontSize = 15.sp)
            Text(java.time.Instant.ofEpochMilli(u.at).atZone(ZoneId.of("Europe/Zurich")).toLocalTime().format(java.time.format.DateTimeFormatter.ofPattern("HH:mm")) + " · " +
                if (ok) t(R.string.labs_out_saved, u.count) else t(when (u.outcome) {
                    "duplicate" -> R.string.labs_out_duplicate
                    "conflict" -> R.string.labs_out_conflict
                    "format" -> R.string.labs_out_format
                    "unreadable" -> R.string.labs_out_unreadable
                    "date" -> R.string.labs_out_date
                    "duplicate_tests" -> R.string.labs_out_duplicate_tests
                    "no_results" -> R.string.labs_out_no_results
                    else -> R.string.labs_out_failed
                }), color = if (ok || u.outcome == "duplicate") C.Muted else C.Alert, fontSize = 13.sp)
        }
        if (ok) TextButton(onClick = onDelete) { Text(t(R.string.delete), color = C.Muted, fontSize = 13.sp) }
    }
}

/**
 * The three steps on one bar that fills as the work really goes on, then the outcome. It closes by itself a few
 * seconds later (LabImport). Never a red: a failure is said in words, in the soft warning colour.
 */
@Composable
private fun ImportProgress(status: LabImport.Status) {
    val labels = listOf(t(R.string.labs_short_read), t(R.string.labs_short_scan), t(R.string.labs_short_upload))
    val done = status.stage == LabImport.Stage.DONE
    val failed = status.stage == LabImport.Stage.FAILED
    val at = status.step
    val tint = when { failed -> C.Alert; done -> C.Dia; else -> C.Sys }
    val progress by androidx.compose.animation.core.animateFloatAsState(
        if (done) 1f else (at + if (failed) 0.5f else 0.6f) / 3f, androidx.compose.animation.core.tween(700), label = "progress")
    val pulse by androidx.compose.animation.core.rememberInfiniteTransition(label = "pulse").animateFloat(
        0.35f, 1f, androidx.compose.animation.core.infiniteRepeatable(androidx.compose.animation.core.tween(700),
            androidx.compose.animation.core.RepeatMode.Reverse), label = "a")
    Panel {
        Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
            Text(when { done -> t(R.string.labs_progress_done); failed -> t(R.string.labs_progress_failed); else -> t(R.string.labs_progress_title) },
                color = C.Ink, fontSize = 16.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold, modifier = Modifier.weight(1f))
            Text(if (done || failed) "" else "${(progress * 100).toInt()} %", color = C.Muted, fontSize = 13.sp)
        }
        Spacer(Modifier.height(10.dp))
        LinearProgressIndicator(
            progress = { progress }, color = tint, trackColor = C.Surface2,
            strokeCap = androidx.compose.ui.graphics.StrokeCap.Round,
            modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp))
        )
        Spacer(Modifier.height(12.dp))
        Row(Modifier.fillMaxWidth()) {
            labels.forEachIndexed { i, label ->
                val passed = done || i < at
                val current = i == at && !done
                Row(Modifier.weight(1f), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                    val c = when { passed -> C.Dia; current && failed -> C.Alert; current -> C.Sys; else -> C.Muted }
                    Box(Modifier.size(22.dp).clip(androidx.compose.foundation.shape.CircleShape)
                        .background(if (passed || current) c.copy(alpha = if (current && !failed) 0.25f + 0.3f * pulse else 0.25f) else C.Surface2),
                        contentAlignment = androidx.compose.ui.Alignment.Center) {
                        Text(when { passed -> "✓"; current && failed -> "!"; else -> "${i + 1}" }, color = if (passed || current) c else C.Muted,
                            fontSize = 12.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)
                    }
                    Spacer(Modifier.width(6.dp))
                    Text(label, color = if (passed || current) C.Ink else C.Muted, fontSize = 12.sp, maxLines = 1)
                }
            }
        }
        Spacer(Modifier.height(12.dp))
        Text(status.text, color = if (failed) C.Alert else C.Ink, fontSize = 14.sp)
    }
}
