package ch.personalhealthy.app

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import androidx.compose.ui.text.input.KeyboardType
import android.content.Context
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

/* ---------------- Colors ---------------- */

object C {
    val Bg = Color(0xFF0F1D38)
    val Surface = Color(0xFF172B50)
    val Surface2 = Color(0xFF1C335E)
    val Ink = Color(0xFFEAF0FA)
    val Muted = Color(0xFF9AAACA)
    val Line = Color(0x1AEAF0FA)
    val Sys = Color(0xFFFF7086)
    val Dia = Color(0xFF62B6FF)
    val Pul = Color(0xFFFFC766)
    val Alert = Color(0xFFFF6178)
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Txt.init(this)   // texts in the phone's language
        Notif.schedule(this)
        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(
                    background = C.Bg, surface = C.Surface, primary = C.Sys,
                    onPrimary = Color.White, onBackground = C.Ink, onSurface = C.Ink
                )
            ) { App() }
        }
    }
}

private fun toast(ctx: Context, msg: String) = Toast.makeText(ctx, msg, Toast.LENGTH_LONG).show()

/* ---------------- Navigation and state ---------------- */

@Composable
fun App() {
    val ctx = LocalContext.current
    val prefs = remember { ctx.getSharedPreferences("battito", Context.MODE_PRIVATE) } // keep: existing storage name
    var personId by remember { mutableStateOf(prefs.getString("personId", null)) }
    var screen by rememberSaveable { mutableStateOf("home") }
    val readings = remember { mutableStateListOf<Reading>() }
    var loading by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    var scan by remember { mutableStateOf<ScanState>(ScanState.Idle) }
    var saving by remember { mutableStateOf(false) }
    var takenAt by rememberSaveable { mutableLongStateOf(0L) }
    var me by remember { mutableStateOf<Me?>(null) }
    val scope = rememberCoroutineScope()

    val photoFile = remember { File(File(ctx.cacheDir, "photos").apply { mkdirs() }, "scan.jpg") }
    val photoUri = remember { FileProvider.getUriForFile(ctx, ctx.packageName + ".files", photoFile) }

    fun reload() {
        val pid = personId ?: return
        scope.launch {
            loading = true
            try {
                val l = Repo.list(pid)
                readings.clear(); readings.addAll(l); message = null
                val m = Repo.me(pid)
                me = m
                Notif.check(ctx, m.credit, m.isAdmin)
            } catch (e: Exception) {
                message = e.message ?: t(R.string.err_generic)
            } finally { loading = false }
        }
    }

    fun runScan() {
        val pid = personId ?: return
        scan = ScanState.Loading
        scope.launch {
            try {
                val img = withContext(Dispatchers.IO) { Img.prepare(photoFile) }
                val res = Repo.scan(pid, img, takenAt)
                scan = ScanState.Done(res)
                if (res.credit != null) {
                    me = me?.copy(credit = res.credit)
                    Notif.check(ctx, res.credit, me?.isAdmin ?: false)
                }
            } catch (e: Exception) {
                scan = ScanState.Failed(e.message ?: t(R.string.err_read_failed))
            }
        }
    }

    val camera = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { ok ->
        if (ok) {
            takenAt = System.currentTimeMillis()   // date and time: those of the shot, cannot be changed
            screen = "scan"
            runScan()
        } else if (screen == "scan" && scan !is ScanState.Done) {
            screen = "home"
        }
    }
    fun openCamera() {
        try { camera.launch(photoUri) } catch (e: ActivityNotFoundException) { toast(ctx, t(R.string.no_camera)) }
    }

    val notifPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }
    LaunchedEffect(personId) {
        reload()
        if (personId != null && Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) notifPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
    }
    BackHandler(enabled = screen != "home") { screen = "home"; scan = ScanState.Idle }

    Box(Modifier.fillMaxSize().background(C.Bg)) {
        when {
            personId == null -> SetupScreen { pid ->
                prefs.edit().putString("personId", pid).apply()
                personId = pid
            }
            screen == "scan" -> ScanScreen(
                state = scan, saving = saving,
                onSave = { r ->
                    val pid = personId ?: return@ScanScreen
                    saving = true
                    scope.launch {
                        try {
                            Repo.confirm(pid, r.scanId)
                            toast(ctx, t(R.string.saved))
                            screen = "home"; scan = ScanState.Idle
                            reload()
                        } catch (e: Exception) {
                            toast(ctx, e.message ?: t(R.string.err_generic))
                        } finally { saving = false }
                    }
                },
                onRetake = { openCamera() },
                onCancel = { screen = "home"; scan = ScanState.Idle }
            )
            screen == "report" -> ReportScreen(readings) { screen = "home" }
            screen == "settings" -> SettingsScreen(
                me = me, personId = personId ?: "",
                onChanged = { c -> me = me?.copy(credit = c); Notif.check(ctx, c, true) },
                onBillingChanged = { mode -> me = me?.copy(billingMode = mode) },
                onBack = { screen = "home" }
            )
            else -> HomeScreen(
                readings = readings, loading = loading, message = message, me = me,
                onSettings = { screen = "settings" },
                onMeasure = { openCamera() },
                onReport = { screen = "report" },
                onRefresh = { reload() },
                onDelete = { r ->
                    val pid = personId ?: return@HomeScreen
                    scope.launch {
                        try { Repo.delete(pid, r.id); toast(ctx, t(R.string.deleted)); reload() }
                        catch (e: Exception) { toast(ctx, e.message ?: t(R.string.err_generic)) }
                    }
                }
            )
        }
    }
}

/* ---------------- Common UI elements ---------------- */

@Composable
fun Panel(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier.fillMaxWidth().padding(vertical = 7.dp).clip(RoundedCornerShape(22.dp))
            .background(C.Surface).border(1.dp, C.Line, RoundedCornerShape(22.dp)).padding(18.dp),
        content = content
    )
}

@Composable
fun BigButton(text: String, color: Color = C.Sys, textColor: Color = Color.White, enabled: Boolean = true, onClick: () -> Unit) {
    Box(
        Modifier.fillMaxWidth().padding(vertical = 6.dp).height(58.dp).clip(RoundedCornerShape(18.dp))
            .background(if (enabled) color else color.copy(alpha = 0.35f))
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center
    ) { Text(text, color = textColor, fontSize = 17.sp, fontWeight = FontWeight.SemiBold) }
}

@Composable
fun Header(title: String, subtitle: String? = null, action: String? = null, onAction: (() -> Unit)? = null, titleSize: Int = 26) {
    Row(Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(title, color = C.Ink, fontSize = titleSize.sp, fontWeight = FontWeight.Light)
            if (subtitle != null) Text(subtitle, color = C.Muted, fontSize = 14.sp)
        }
        if (action != null && onAction != null) TextButton(onClick = onAction) { Text(action, color = C.Muted) }
    }
}

@Composable
fun LevelChip(level: Level) {
    val col = Color(level.color)
    Row(
        Modifier.clip(RoundedCornerShape(50)).background(col.copy(alpha = 0.15f)).padding(horizontal = 10.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(Modifier.size(7.dp).clip(CircleShape).background(col))
        Spacer(Modifier.width(6.dp))
        Text(level.label, color = col, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
fun EcgLine(modifier: Modifier = Modifier) {
    Canvas(modifier.fillMaxWidth().height(34.dp)) {
        val w = size.width
        val h = size.height
        val pts = listOf(0f to .5f, .37f to .5f, .41f to .32f, .45f to .5f, .48f to .5f, .5f to .05f, .53f to .95f, .555f to .5f, .6f to .5f, .64f to .36f, .67f to .5f, 1f to .5f)
        val p = Path()
        pts.forEachIndexed { i, (x, y) -> if (i == 0) p.moveTo(x * w, y * h) else p.lineTo(x * w, y * h) }
        drawPath(p, C.Ink.copy(alpha = 0.8f), style = Stroke(width = 2.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round))
    }
}

@Composable
fun BpChart(list: List<Reading>, start: java.time.LocalDate, days: Int, modifier: Modifier) {
    Canvas(modifier) {
        drawIntoCanvas { canvas ->
            drawBpChart(canvas.nativeCanvas, size.width, size.height, list, start, days, SCREEN_PAL, 11.sp.toPx())
        }
    }
}

@Composable
fun StatBox(label: String, value: String, note: String? = null, color: Color = C.Ink, modifier: Modifier = Modifier) {
    Column(modifier.padding(4.dp).clip(RoundedCornerShape(16.dp)).background(C.Surface2).padding(12.dp)) {
        Text(label, color = C.Muted, fontSize = 12.sp)
        Text(value, color = color, fontSize = 22.sp, fontWeight = FontWeight.Light)
        if (note != null) Text(note, color = C.Muted, fontSize = 12.sp)
    }
}

/* ---------------- Activation ---------------- */

@Composable
fun SetupScreen(onDone: (String) -> Unit) {
    var code by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var err by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.Center) {
        Text(t(R.string.app_name), color = C.Ink, fontSize = 28.sp, fontWeight = FontWeight.ExtraLight)
        EcgLine(Modifier.padding(vertical = 8.dp))
        Text(t(R.string.setup_intro), color = C.Muted, fontSize = 15.sp)
        Spacer(Modifier.height(20.dp))
        OutlinedTextField(
            value = code, onValueChange = { code = it.trim() }, singleLine = true,
            label = { Text(t(R.string.family_code)) },
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.None),
            colors = OutlinedTextFieldDefaults.colors(focusedTextColor = C.Ink, unfocusedTextColor = C.Ink, focusedBorderColor = C.Sys, unfocusedBorderColor = C.Line),
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(Modifier.height(12.dp))
        BigButton(if (busy) t(R.string.activating) else t(R.string.activate), enabled = code.length >= 4 && !busy) {
            busy = true; err = null
            scope.launch {
                try { onDone(Repo.register(code)) } catch (e: Exception) { err = e.message } finally { busy = false }
            }
        }
        err?.let { Text(it, color = C.Alert, modifier = Modifier.padding(top = 8.dp)) }
        Spacer(Modifier.height(18.dp))
        Text(t(R.string.setup_privacy), color = C.Muted, fontSize = 13.sp)
    }
}

/* ---------------- Home ---------------- */

@Composable
fun HomeScreen(
    readings: List<Reading>, loading: Boolean, message: String?, me: Me?, onSettings: () -> Unit,
    onMeasure: () -> Unit, onReport: () -> Unit, onRefresh: () -> Unit, onDelete: (Reading) -> Unit
) {
    var toDelete by remember { mutableStateOf<Reading?>(null) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 18.dp, vertical = 12.dp)) {
        Header(t(R.string.app_name), t(R.string.tagline), if (loading) "…" else t(R.string.refresh), onRefresh, titleSize = 20)
        if (message != null) Panel { Text(message, color = C.Alert, fontSize = 14.sp) }

        val last = readings.lastOrNull()
        Panel {
            if (last == null) {
                Text(t(R.string.no_readings_title), color = C.Ink, fontSize = 20.sp)
                Text(t(R.string.no_readings_text), color = C.Muted, fontSize = 14.sp)
            } else {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(t(R.string.last_fmt, Z.whenText(last.takenAt)), color = C.Muted, fontSize = 14.sp, modifier = Modifier.weight(1f))
                    LevelChip(classify(last.sis, last.dia))
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("${last.sis}", color = C.Sys, fontSize = 78.sp, fontWeight = FontWeight.ExtraLight, lineHeight = 80.sp)
                        EcgLine()
                        Text("${last.dia}", color = C.Dia, fontSize = 78.sp, fontWeight = FontWeight.ExtraLight, lineHeight = 80.sp)
                        Text(t(R.string.mmhg_hint), color = C.Muted, fontSize = 12.sp)
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text(last.pul?.toString() ?: "—", color = C.Pul, fontSize = 32.sp, fontWeight = FontWeight.Light)
                        Text(t(R.string.pulse_lower), color = C.Muted, fontSize = 12.sp)
                    }
                }
            }
        }

        BigButton(t(R.string.measure), onClick = onMeasure)

        CreditPanel(me, onSettings)

        WeekPanel(readings)

        val today = Z.today()
        val week = readings.filter { !Z.date(it.takenAt).isBefore(today.minusDays(6)) }
        Panel {
            Row { Text(t(R.string.last7), color = C.Ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f)); Text(t(R.string.n_readings, week.size), color = C.Muted, fontSize = 13.sp) }
            Spacer(Modifier.height(10.dp))
            BpChart(week, today.minusDays(6), 7, Modifier.fillMaxWidth().height(210.dp))
            Legend()
        }
        val st = stats(week)
        Row(Modifier.fillMaxWidth()) {
            StatBox(t(R.string.avg7), if (st.n > 0) "${st.sis}/${st.dia}" else "—", "mmHg", modifier = Modifier.weight(1f))
            StatBox(t(R.string.peak_sys), st.maxS?.let { "${it.sis}/${it.dia}" } ?: "—", st.maxS?.let { Z.whenText(it.takenAt) }, C.Sys, Modifier.weight(1f))
        }

        val p7 = periodInfo(readings, 7)
        Panel {
            Text(t(R.string.report_card_title), color = C.Ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
            Text(
                if (p7.ok) t(R.string.report_ready7) else t(R.string.report_missing7, p7.missing),
                color = C.Muted, fontSize = 14.sp
            )
            BigButton(t(R.string.open_report), color = C.Surface2, textColor = C.Ink, onClick = onReport)
        }

        if (readings.isNotEmpty()) {
            Text(t(R.string.recent), color = C.Muted, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 12.dp, bottom = 4.dp, start = 4.dp))
            readings.takeLast(14).reversed().forEach { r ->
                Row(
                    Modifier.fillMaxWidth().padding(vertical = 4.dp).clip(RoundedCornerShape(16.dp)).background(C.Surface).padding(horizontal = 14.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(Modifier.width(96.dp)) {
                        Text(Z.relDay(Z.date(r.takenAt)), color = C.Ink, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                        Text("${Z.time(r.takenAt)}, ${periodLabel(r.period).lowercase()}", color = C.Muted, fontSize = 12.sp)
                    }
                    Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
                        Text("${r.sis}", color = C.Sys, fontSize = 20.sp, fontWeight = FontWeight.Light)
                        Text("/", color = C.Muted, fontSize = 20.sp)
                        Text("${r.dia}", color = C.Dia, fontSize = 20.sp, fontWeight = FontWeight.Light)
                        if (r.pul != null) Text("  ♥ ${r.pul}", color = C.Pul, fontSize = 13.sp)
                    }
                    TextButton(onClick = { toDelete = r }) { Text(t(R.string.delete), color = C.Muted, fontSize = 12.sp) }
                }
            }
        }
        Spacer(Modifier.height(24.dp))
    }

    toDelete?.let { r ->
        AlertDialog(
            onDismissRequest = { toDelete = null },
            title = { Text(t(R.string.delete_q)) },
            text = { Text("${r.sis}/${r.dia}, ${Z.whenText(r.takenAt)}") },
            confirmButton = { TextButton(onClick = { onDelete(r); toDelete = null }) { Text(t(R.string.delete), color = C.Alert) } },
            dismissButton = { TextButton(onClick = { toDelete = null }) { Text(t(R.string.cancel)) } },
            containerColor = C.Surface
        )
    }
}

@Composable
fun Legend() {
    Row(Modifier.padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(9.dp).clip(RoundedCornerShape(2.dp)).background(C.Sys)); Text(" " + t(R.string.legend_sys) + "   ", color = C.Muted, fontSize = 12.sp)
        Box(Modifier.size(9.dp).clip(RoundedCornerShape(2.dp)).background(C.Dia)); Text(" " + t(R.string.legend_dia) + "   ", color = C.Muted, fontSize = 12.sp)
        Text(t(R.string.legend_threshold), color = C.Muted, fontSize = 12.sp)
    }
}

@Composable
fun WeekPanel(readings: List<Reading>) {
    val today = Z.today()
    val days = (6 downTo 0).map { today.minusDays(it.toLong()) }
    val done = days.sumOf { d ->
        val l = readings.filter { Z.date(it.takenAt) == d }
        (if (l.any { it.period == "morning" }) 1 else 0) + (if (l.any { it.period == "evening" }) 1 else 0)
    }
    Panel {
        Row { Text(t(R.string.this_week), color = C.Ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f)); Text(t(R.string.week_done, done), color = C.Muted, fontSize = 13.sp) }
        Spacer(Modifier.height(12.dp))
        Row(Modifier.fillMaxWidth()) {
            days.forEach { d ->
                val l = readings.filter { Z.date(it.takenAt) == d }
                val m = l.any { it.period == "morning" }
                val e = l.any { it.period == "evening" }
                Column(Modifier.weight(1f).padding(horizontal = 3.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(Z.weekday(d).trimEnd('.'), color = C.Muted, fontSize = 12.sp)
                    Text("${d.dayOfMonth}", color = if (d == today) C.Sys else C.Ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(4.dp))
                    Box(Modifier.fillMaxWidth().height(14.dp).clip(RoundedCornerShape(5.dp)).background(if (m) C.Dia else C.Surface2))
                    Spacer(Modifier.height(4.dp))
                    Box(Modifier.fillMaxWidth().height(14.dp).clip(RoundedCornerShape(5.dp)).background(if (e) C.Sys else C.Surface2))
                }
            }
        }
        Row(Modifier.padding(top = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(9.dp).clip(RoundedCornerShape(2.dp)).background(C.Dia)); Text(" " + t(R.string.legend_morning) + "   ", color = C.Muted, fontSize = 12.sp)
            Box(Modifier.size(9.dp).clip(RoundedCornerShape(2.dp)).background(C.Sys)); Text(" " + t(R.string.legend_evening), color = C.Muted, fontSize = 12.sp)
        }
    }
}

/* ---------------- Photo reading ---------------- */

@Composable
fun ScanScreen(state: ScanState, saving: Boolean, onSave: (ScanResult) -> Unit, onRetake: () -> Unit, onCancel: () -> Unit) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 18.dp, vertical = 12.dp)) {
        Header(t(R.string.new_reading), t(R.string.new_reading_sub), t(R.string.cancel), onCancel)
        when (state) {
            is ScanState.Idle, is ScanState.Loading -> Panel {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(color = C.Sys, strokeWidth = 3.dp, modifier = Modifier.size(28.dp))
                    Spacer(Modifier.width(14.dp))
                    Text(t(R.string.reading_display), color = C.Ink, fontSize = 16.sp)
                }
                Text(t(R.string.few_seconds), color = C.Muted, fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp))
            }
            is ScanState.Failed -> {
                Panel { Text(state.msg, color = C.Ink, fontSize = 16.sp) }
                BigButton(t(R.string.retake), onClick = onRetake)
            }
            is ScanState.Done -> {
                val r = state.r
                if (!r.readable || r.sis == null || r.dia == null) {
                    Panel {
                        Text(t(R.string.unreadable_title), color = C.Ink, fontSize = 17.sp)
                        Text(t(R.string.unreadable_hint), color = C.Muted, fontSize = 14.sp)
                        if (r.note.isNotBlank()) Text(r.note, color = C.Muted, fontSize = 13.sp, modifier = Modifier.padding(top = 6.dp))
                    }
                    BigButton(t(R.string.retake), onClick = onRetake)
                } else {
                    Panel {
                        Row(Modifier.fillMaxWidth()) {
                            ValueBox(t(R.string.legend_sys), r.sis.toString(), C.Sys, Modifier.weight(1f))
                            ValueBox(t(R.string.legend_dia), r.dia.toString(), C.Dia, Modifier.weight(1f))
                            ValueBox(t(R.string.label_pul), r.pul?.toString() ?: "—", C.Pul, Modifier.weight(1f))
                        }
                        Spacer(Modifier.height(12.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(Z.whenText(r.takenAt), color = C.Ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                                Text(t(R.string.period_fmt, periodLabel(r.period)), color = C.Muted, fontSize = 13.sp)
                            }
                            LevelChip(classify(r.sis, r.dia))
                        }
                        if (r.note.isNotBlank()) Text(r.note, color = C.Muted, fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp))
                    }
                    Text(t(R.string.check_numbers), color = C.Muted, fontSize = 14.sp, modifier = Modifier.padding(vertical = 6.dp))
                    BigButton(if (saving) t(R.string.saving) else t(R.string.save), enabled = !saving) { onSave(r) }
                    BigButton(t(R.string.mismatch), color = C.Surface2, textColor = C.Ink, enabled = !saving, onClick = onRetake)
                }
            }
        }
    }
}

@Composable
fun ValueBox(label: String, value: String, color: Color, modifier: Modifier) {
    Column(modifier.padding(4.dp).clip(RoundedCornerShape(16.dp)).background(C.Surface2).padding(vertical = 12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(label, color = C.Muted, fontSize = 12.sp)
        Text(value, color = color, fontSize = 38.sp, fontWeight = FontWeight.ExtraLight, textAlign = TextAlign.Center)
    }
}

/* ---------------- Report ---------------- */

@Composable
fun ReportScreen(readings: List<Reading>, onBack: () -> Unit) {
    val ctx = LocalContext.current
    var n by rememberSaveable { mutableIntStateOf(7) }
    val infos = listOf(7, 15, 30).associateWith { periodInfo(readings, it) }
    val per = infos.getValue(n)
    val st = stats(per.list)

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 18.dp, vertical = 12.dp)) {
        Header(t(R.string.report_title), t(R.string.report_sub), t(R.string.back), onBack)

        Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(C.Surface).padding(4.dp)) {
            listOf(7, 15, 30).forEach { d ->
                val info = infos.getValue(d)
                val sel = d == n
                Column(
                    Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(if (sel) C.Surface2 else Color.Transparent)
                        .clickable(enabled = info.ok || sel) { n = d }.padding(vertical = 10.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(t(R.string.n_days, d), color = if (info.ok || sel) C.Ink else C.Muted.copy(alpha = 0.5f), fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                    Text(if (info.ok) t(R.string.ready) else t(R.string.missing_days_short, info.missing), color = C.Muted, fontSize = 11.sp)
                }
            }
        }

        if (per.list.isEmpty()) {
            Panel { Text(t(R.string.report_empty), color = C.Muted) }
            return@Column
        }

        Panel {
            Text(t(R.string.range_fmt, Z.short(per.start), Z.long(per.end)), color = C.Muted, fontSize = 13.sp)
            Spacer(Modifier.height(8.dp))
            BpChart(per.list, per.start, n, Modifier.fillMaxWidth().height(260.dp))
            Legend()
        }
        Row(Modifier.fillMaxWidth()) {
            StatBox(t(R.string.period_avg), "${st.sis}/${st.dia}", t(R.string.n_in_days, st.n, st.days), modifier = Modifier.weight(1f))
            StatBox(t(R.string.avg_pulse), st.pul?.toString() ?: "—", t(R.string.per_minute), modifier = Modifier.weight(1f))
        }
        Row(Modifier.fillMaxWidth()) {
            StatBox(t(R.string.avg_morning), if (st.mN > 0) "${st.mS}/${st.mD}" else "—", t(R.string.n_readings, st.mN), modifier = Modifier.weight(1f))
            StatBox(t(R.string.avg_evening), if (st.eN > 0) "${st.eS}/${st.eD}" else "—", t(R.string.n_readings, st.eN), modifier = Modifier.weight(1f))
        }
        Row(Modifier.fillMaxWidth()) {
            StatBox(t(R.string.peak_sys), st.maxS?.let { "${it.sis}/${it.dia}" } ?: "—", st.maxS?.let { Z.whenText(it.takenAt) }, C.Sys, Modifier.weight(1f))
            StatBox(t(R.string.max_dia), st.maxD?.let { "${it.sis}/${it.dia}" } ?: "—", st.maxD?.let { Z.whenText(it.takenAt) }, C.Dia, Modifier.weight(1f))
        }
        Row(Modifier.fillMaxWidth()) {
            StatBox(t(R.string.lowest), st.minS?.let { "${it.sis}/${it.dia}" } ?: "—", st.minS?.let { Z.whenText(it.takenAt) }, modifier = Modifier.weight(1f))
            StatBox(t(R.string.above_thr), "${st.over}", t(R.string.of_n, st.n), modifier = Modifier.weight(1f))
        }

        Spacer(Modifier.height(8.dp))
        if (!per.ok) Text(t(R.string.report_not_yet, n, per.missing), color = C.Muted, fontSize = 14.sp)
        BigButton(t(R.string.send_pdf), enabled = per.ok) {
            try { shareFile(ctx, buildPdf(ctx, readings, n), "application/pdf") } catch (e: Exception) { toast(ctx, t(R.string.file_failed, e.message ?: "")) }
        }
        BigButton(t(R.string.send_excel), color = C.Surface2, textColor = C.Ink, enabled = per.ok) {
            try { shareFile(ctx, buildCsv(ctx, readings, n), "text/csv") } catch (e: Exception) { toast(ctx, t(R.string.file_failed, e.message ?: "")) }
        }
        Text(t(R.string.threshold_note), color = C.Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp, bottom = 24.dp))
    }
}


/* ---------------- Credit ---------------- */

@Composable
fun CreditPanel(me: Me?, onSettings: () -> Unit) {
    if (me == null) return
    val c = me.credit
    Panel {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(t(R.string.credit_title), color = C.Ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
            if (me.isAdmin) TextButton(onClick = onSettings) { Text(t(R.string.manage), color = C.Muted) }
        }
        if (c == null || !c.configured) {
            Text(
                if (me.isAdmin) t(R.string.credit_not_set_admin) else t(R.string.credit_not_set_user),
                color = C.Muted, fontSize = 14.sp
            )
        } else {
            val col = when { c.empty -> C.Alert; c.low -> Color(Level.WARN.color); else -> C.Ink }
            Row(verticalAlignment = Alignment.Bottom) {
                Text(usd(c.remaining ?: 0.0), color = col, fontSize = 30.sp, fontWeight = FontWeight.Light)
                Spacer(Modifier.width(10.dp))
                Text(t(R.string.photos_left, c.photosLeft ?: 0), color = C.Muted, fontSize = 14.sp, modifier = Modifier.padding(bottom = 5.dp))
            }
            if (c.empty) Text(t(R.string.credit_empty_msg), color = C.Alert, fontSize = 13.sp)
            else if (c.low) Text(t(R.string.credit_low_msg), color = Color(Level.WARN.color), fontSize = 13.sp)
        }
    }
}

@Composable
fun SettingsScreen(me: Me?, personId: String, onChanged: (Credit?) -> Unit, onBillingChanged: (String) -> Unit, onBack: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var amount by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    val c = me?.credit

    fun send(action: String) {
        val v = amount.replace(',', '.').toDoubleOrNull()
        if (v == null || v < 0 || (action == "topup" && v == 0.0)) { toast(ctx, t(R.string.enter_amount)); return }
        busy = true
        scope.launch {
            try {
                onChanged(Repo.credit(personId, action, v))
                amount = ""
                toast(ctx, if (action == "topup") t(R.string.topup_added) else t(R.string.balance_updated))
            } catch (e: Exception) { toast(ctx, e.message ?: t(R.string.err_generic)) } finally { busy = false }
        }
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 18.dp, vertical = 12.dp)) {
        Header(t(R.string.settings), t(R.string.settings_sub), t(R.string.back), onBack)

        Panel {
            Text(t(R.string.credit_section), color = C.Ink, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(6.dp))
            if (c != null && c.configured) {
                Text(t(R.string.est_balance, usd(c.remaining ?: 0.0)), color = C.Ink, fontSize = 20.sp, fontWeight = FontWeight.Light)
                Text(t(R.string.avg_cost, usdFine(c.avgCost), c.photosLeft ?: 0), color = C.Muted, fontSize = 13.sp)
            } else {
                Text(t(R.string.no_credit), color = C.Muted, fontSize = 14.sp)
            }
            Spacer(Modifier.height(14.dp))
            OutlinedTextField(
                value = amount, onValueChange = { txt -> amount = txt.filter { it.isDigit() || it == ',' || it == '.' }.take(7) },
                singleLine = true, label = { Text(t(R.string.amount_usd)) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                colors = OutlinedTextFieldDefaults.colors(focusedTextColor = C.Ink, unfocusedTextColor = C.Ink, focusedBorderColor = C.Sys, unfocusedBorderColor = C.Line),
                modifier = Modifier.fillMaxWidth()
            )
            BigButton(t(R.string.add_topup), enabled = !busy) { send("topup") }
            BigButton(t(R.string.set_balance), color = C.Surface2, textColor = C.Ink, enabled = !busy) { send("set") }
            Text(
                t(R.string.credit_help),
                color = C.Muted, fontSize = 13.sp
            )
        }

        Panel {
            Text(t(R.string.who_pays), color = C.Ink, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(8.dp))
            val mode = me?.billingMode ?: "private"
            ModeRow(t(R.string.mode_private), t(R.string.mode_private_sub), mode == "private", true) {
                if (mode != "private") scope.launch {
                    try { Repo.setBilling(personId, "private"); onBillingChanged("private") } catch (e: Exception) { toast(ctx, e.message ?: t(R.string.err_generic)) }
                }
            }
            ModeRow(t(R.string.mode_user), t(R.string.coming_soon), mode == "per_user", false) { }
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
fun ModeRow(title: String, sub: String, selected: Boolean, enabled: Boolean, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 4.dp).clip(RoundedCornerShape(14.dp))
            .background(if (selected) C.Surface2 else Color.Transparent)
            .border(1.dp, if (selected) C.Sys else C.Line, RoundedCornerShape(14.dp))
            .clickable(enabled = enabled, onClick = onClick).padding(14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(Modifier.size(18.dp).clip(CircleShape).border(2.dp, if (selected) C.Sys else C.Muted, CircleShape), contentAlignment = Alignment.Center) {
            if (selected) Box(Modifier.size(9.dp).clip(CircleShape).background(C.Sys))
        }
        Spacer(Modifier.width(12.dp))
        Column {
            Text(title, color = if (enabled) C.Ink else C.Muted, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
            Text(sub, color = C.Muted, fontSize = 12.sp)
        }
    }
}
