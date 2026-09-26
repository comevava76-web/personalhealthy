package ch.personalhealthy.app

import android.Manifest
import android.content.ActivityNotFoundException
import android.app.Activity
import android.content.Intent
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import java.util.Locale
import android.net.Uri
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import androidx.compose.ui.text.input.KeyboardType
import android.content.Context
import android.os.Bundle
import android.os.SystemClock
import android.view.View
import android.view.ViewTreeObserver
import android.widget.Toast
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.fragment.app.FragmentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
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
import androidx.compose.material3.Icon
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
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
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlin.math.roundToInt
import java.io.File

/* ---------------- Colors ---------------- */

object C {
    val Bg = Color(0xFF0F1D38)
    val Surface = Color(0xFF172B50)
    val Surface2 = Color(0xFF1C335E)
    val Ink = Color(0xFFEAF0FA)
    val Muted = Color(0xFF9AAACA)
    val Line = Color(0x1AEAF0FA)
    val Sys = Color(0xFFF2545B)   // systolic, coral
    val Dia = Color(0xFF3FA7D6)   // diastolic, teal-blue
    val Pul = Color(0xFFFFC145)   // pulse, amber
    val Alert = Color(0xFFFF6178)
}

class MainActivity : FragmentActivity() {
    // App lock: fingerprint, face or the phone's own screen lock (no separate PIN).
    // Locked at start and after more than LOCK_AFTER_MS away from the app.
    private var locked by mutableStateOf(true)
    private var hiddenAt = 0L
    private var asking = false   // the fingerprint / screen-lock window is open
    private lateinit var prompt: BiometricPrompt

    private fun lockAvailable(): Boolean =
        getSharedPreferences("battito", Context.MODE_PRIVATE).getString("personId", null) != null &&
            BiometricManager.from(this).canAuthenticate(LOCK_AUTH) == BiometricManager.BIOMETRIC_SUCCESS

    fun unlock() {
        if (!lockAvailable()) { locked = false; return }
        if (asking) return
        asking = true
        prompt.authenticate(
            BiometricPrompt.PromptInfo.Builder()
                .setTitle(t(R.string.lock_prompt_title))
                .setSubtitle(t(R.string.lock_prompt_sub))
                .setAllowedAuthenticators(LOCK_AUTH)
                .build()
        )
    }

    override fun onStart() {
        super.onStart()
        if (hiddenAt != 0L && SystemClock.elapsedRealtime() - hiddenAt > LOCK_AFTER_MS) locked = true
        if (locked && !lockAvailable()) locked = false
    }

    override fun onResume() {
        super.onResume()
        if (locked) unlock()
    }

    override fun onStop() {
        super.onStop()
        hiddenAt = SystemClock.elapsedRealtime()
    }

    // The camera (or rotating the phone) can make Android rebuild this screen, or even restart the app:
    // remember that it was already unlocked, so the photo is read instead of asking to unlock again.
    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putBoolean("locked", locked)
        outState.putLong("hiddenAt", hiddenAt)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (savedInstanceState != null) {
            locked = savedInstanceState.getBoolean("locked", true)
            hiddenAt = savedInstanceState.getLong("hiddenAt", 0L)
        }
        Txt.init(this)   // texts in the phone's language
        prompt = BiometricPrompt(this, ContextCompat.getMainExecutor(this), object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) { asking = false; locked = false }
            // cancelled or too many attempts: stays locked, the Unlock button tries again
            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) { asking = false }
        })
        Reminders.stopCreditNotifications(this)
        Reminders.schedule(this)
        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(
                    background = C.Bg, surface = C.Surface, primary = C.Sys,
                    onPrimary = Color.White, onBackground = C.Ink, onSurface = C.Ink
                )
            ) {
                Box(Modifier.fillMaxSize()) {
                    App()
                    // drawn over the app, so what was on screen (a photo being read, for example) is kept
                    if (locked) LockScreen { unlock() }
                }
            }
        }
        if (Build.VERSION.SDK_INT >= 31) keepSplashFor(1000)
    }

        companion object {
        private const val LOCK_AUTH = BiometricManager.Authenticators.BIOMETRIC_WEAK or BiometricManager.Authenticators.DEVICE_CREDENTIAL
        private const val LOCK_AFTER_MS = 2 * 60 * 1000L
    }

    /** Keeps the Android 12+ launch screen up long enough for the ECG trace animation to finish. */
    private fun keepSplashFor(ms: Long) {
        val start = SystemClock.uptimeMillis()
        val content = findViewById<View>(android.R.id.content)
        content.viewTreeObserver.addOnPreDrawListener(object : ViewTreeObserver.OnPreDrawListener {
            override fun onPreDraw(): Boolean {
                if (SystemClock.uptimeMillis() - start < ms) return false
                content.viewTreeObserver.removeOnPreDrawListener(this)
                return true
            }
        })
    }
}

private fun toast(ctx: Context, msg: String) = Toast.makeText(ctx, msg, Toast.LENGTH_LONG).show()

/* ---------------- Navigation and state ---------------- */

/** Anthropic page where the prepaid credit is recharged. */
const val RECHARGE_URL = "https://console.anthropic.com/settings/billing"

/**
 * Tabs of the bottom bar, in order. A future module (for example "analyses" for uploading
 * blood tests) is added here with its label, plus one branch in App() that shows its screen.
 */
enum class Tab(val key: String, val label: Int) {
    BP("bp", R.string.tab_bp),
    REPORT("report", R.string.tab_report),
    CREDIT("credit", R.string.tab_credit),
}

@Composable
fun App() {
    val ctx = LocalContext.current
    val prefs = remember { ctx.getSharedPreferences("battito", Context.MODE_PRIVATE) } // keep: existing storage name
    var personId by remember { mutableStateOf(prefs.getString("personId", null)) }
    // "tabs", or a full screen without the bottom bar: "scan", "key" (a friend's own key), "invite"
    var screen by rememberSaveable { mutableStateOf("tabs") }
    var tab by rememberSaveable { mutableStateOf(Tab.BP.key) }
    val readings = remember { mutableStateListOf<Reading>() }
    var loading by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    var scan by remember { mutableStateOf<ScanState>(ScanState.Idle) }
    var saving by remember { mutableStateOf(false) }
    var takenAt by rememberSaveable { mutableLongStateOf(0L) }
    var me by remember { mutableStateOf<Me?>(null) }
    var rechargePending by rememberSaveable { mutableStateOf(false) } // true while the Anthropic page is open
    var amountDialog by remember { mutableStateOf<String?>(null) }     // "topup" or "set" while the amount dialog is open
    var inviteDialog by remember { mutableStateOf(false) }             // choosing who to invite
    var invite by remember { mutableStateOf<Invite?>(null) }           // the invite just created
    var keyPromptShown by rememberSaveable { mutableStateOf(false) }  // friend's key steps shown once after opening the app
    var keyBusy by remember { mutableStateOf(false) }
    var keyError by remember { mutableStateOf<ApiException?>(null) }
    var deleteKeyAsk by remember { mutableStateOf(false) }
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
                // a friend without a key yet: straight to the guided steps (once; later from the Credit tab)
                if (m.selfPays && !m.hasKey && !keyPromptShown && screen == "tabs") { keyPromptShown = true; screen = "key" }
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
                if (res.credit != null) me = me?.copy(credit = res.credit)
            } catch (e: Exception) {
                scan = ScanState.Failed(e.message ?: t(R.string.err_read_failed), (e as? ApiException)?.code)
            }
        }
    }

    // Recharge: open the Anthropic billing page; when the user comes back, ask how much was added
    fun openRecharge() {
        rechargePending = true
        try {
            ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(RECHARGE_URL)))
        } catch (e: ActivityNotFoundException) {
            rechargePending = false
            toast(ctx, t(R.string.no_browser))
        }
    }
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            // back in the app: fresh readings and credit (there is no refresh button)
            if (event == Lifecycle.Event.ON_RESUME && !loading) reload()
            if (event == Lifecycle.Event.ON_RESUME && rechargePending) {
                rechargePending = false
                if (me?.canRecharge == true) amountDialog = "topup" else toast(ctx, t(R.string.notif_user_hint))
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    val camera = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { ok ->
        if (ok) {
            takenAt = System.currentTimeMillis()   // date and time: those of the shot, cannot be changed
            screen = "scan"
            runScan()
        } else if (screen == "scan" && scan !is ScanState.Done) {
            screen = "tabs"
        }
    }
    fun openCamera() {
        try { camera.launch(photoUri) } catch (e: ActivityNotFoundException) { toast(ctx, t(R.string.no_camera)) }
    }

    // Values said aloud: the phone's speech recognition, then a confirmation before saving
    var voice by remember { mutableStateOf<Triple<Int, Int, Int?>?>(null) }
    var voiceAt by rememberSaveable { mutableLongStateOf(0L) }   // when the values were said
    var voiceUnusual by remember { mutableStateOf<List<String>>(emptyList()) }
    var voiceSaving by remember { mutableStateOf(false) }
    var voiceProblem by remember { mutableStateOf<String?>(null) }
    fun onSpoken(texts: List<String>) {
        val sp = parseSpoken(texts)
        voice = sp.values
        voiceUnusual = sp.unusual
        if (sp.problem != null) { voiceProblem = sp.problem; screen = "tabs" }
        else { voiceAt = System.currentTimeMillis(); screen = "voice" }   // shown full screen: saved only after Save
    }
    // the phone's standard speech window: only when listening inside the app is not possible
    val speech = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { res ->
        if (res.resultCode != Activity.RESULT_OK) return@rememberLauncherForActivityResult
        onSpoken(res.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS).orEmpty())
    }
    val micPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
        if (ok) screen = "listen" else toast(ctx, t(R.string.voice_permission))
    }
    fun openVoice() {
        if (SpeechRecognizer.isRecognitionAvailable(ctx)) {
            if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) screen = "listen"
            else micPermission.launch(Manifest.permission.RECORD_AUDIO)
            return
        }
        val i = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault().toLanguageTag())
            .putExtra(RecognizerIntent.EXTRA_PROMPT, t(R.string.voice_prompt))
            .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5)
        try { speech.launch(i) } catch (e: ActivityNotFoundException) { toast(ctx, t(R.string.voice_unavailable)) }
    }

    val notifPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }
    LaunchedEffect(personId) {
        reload()
        if (personId != null && Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) notifPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
    }
    BackHandler(enabled = screen != "tabs" || tab != Tab.BP.key) {
        if (screen != "tabs") { screen = "tabs"; scan = ScanState.Idle; keyError = null } else tab = Tab.BP.key
    }

    fun openKeySteps() { keyError = null; scan = ScanState.Idle; screen = "key" }

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
                            screen = "tabs"; tab = Tab.BP.key; scan = ScanState.Idle
                            reload()
                        } catch (e: Exception) {
                            toast(ctx, e.message ?: t(R.string.err_generic))
                        } finally { saving = false }
                    }
                },
                onRetake = { openCamera() },
                onRecharge = { openRecharge() },
                onReplaceKey = { openKeySteps() },
                onCancel = { screen = "tabs"; scan = ScanState.Idle }
            )
            screen == "listen" -> ListenScreen(
                onResult = { onSpoken(it) },
                onFail = { msg -> screen = "tabs"; voiceProblem = msg },
                onCancel = { screen = "tabs" }
            )
            screen == "voice" && voice != null -> VoiceScreen(
                values = voice!!, spokenAt = voiceAt, unusual = voiceUnusual, saving = voiceSaving,
                onSave = {
                    val pid = personId ?: return@VoiceScreen
                    val (sis, dia, pul) = voice!!
                    voiceSaving = true
                    scope.launch {
                        try {
                            Repo.voice(pid, sis, dia, pul ?: return@launch, voiceAt)
                            toast(ctx, t(R.string.saved))
                            voice = null; screen = "tabs"; tab = Tab.BP.key
                            reload()
                        } catch (e: Exception) { toast(ctx, e.message ?: t(R.string.err_generic)) }
                        finally { voiceSaving = false }
                    }
                },
                onRetry = { voice = null; screen = "tabs"; openVoice() },
                onCancel = { voice = null; screen = "tabs" }
            )
            screen == "key" -> KeyScreen(
                hasKey = me?.hasKey == true, busy = keyBusy, error = keyError?.message, errorCode = keyError?.code,
                onSave = { key, amount ->
                    val pid = personId ?: return@KeyScreen
                    keyBusy = true; keyError = null
                    scope.launch {
                        try {
                            val c = Repo.saveKey(pid, key, amount)
                            me = me?.copy(hasKey = true, credit = c ?: me?.credit)
                            toast(ctx, t(R.string.key_saved))
                            screen = "tabs"
                        } catch (e: Exception) { keyError = e as? ApiException ?: ApiException("generic") }
                        finally { keyBusy = false }
                    }
                },
                onRecharge = { openRecharge() },
                onLater = { screen = "tabs"; keyError = null }
            )
            screen == "invite" && invite != null -> InviteScreen(invite!!) { screen = "tabs"; invite = null }
            else -> Column(Modifier.fillMaxSize()) {
                Box(Modifier.weight(1f)) {
                    when (tab) {
                        Tab.REPORT.key -> ReportScreen(readings)
                        Tab.CREDIT.key -> CreditScreen(
                            me = me, onRecharge = { openRecharge() }, onCorrect = { amountDialog = "set" },
                            onInvite = { inviteDialog = true }, onKey = { openKeySteps() }, onDeleteKey = { deleteKeyAsk = true }
                        )
                        else -> HomeScreen(
                            readings = readings, message = message, me = me,
                            onOpenCredit = { tab = Tab.CREDIT.key }, onAddKey = { openKeySteps() },
                            onMeasure = { openCamera() },
                            onVoice = { openVoice() },
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
                BottomBar(tab) { tab = it }
            }
        }
    }

    // what was said cannot be saved: say why, and offer to say it again
    voiceProblem?.let { msg ->
        AlertDialog(
            onDismissRequest = { voiceProblem = null },
            title = { Text(t(R.string.voice_confirm_title)) },
            text = { Text(msg) },
            confirmButton = { TextButton(onClick = { voiceProblem = null; openVoice() }) { Text(t(R.string.voice_retry), color = C.Sys) } },
            dismissButton = { TextButton(onClick = { voiceProblem = null }) { Text(t(R.string.cancel)) } },
            containerColor = C.Surface
        )
    }

    amountDialog?.let { action ->
        AmountDialog(
            title = t(if (action == "topup") R.string.recharge_q else R.string.correct_q),
            onDismiss = { amountDialog = null },
            onSave = { v ->
                val pid = personId ?: return@AmountDialog
                amountDialog = null
                scope.launch {
                    try {
                        val c = Repo.credit(pid, action, v)
                        me = me?.copy(credit = c)
                        toast(ctx, if (action == "topup") t(R.string.topup_added) else t(R.string.balance_updated))
                    } catch (e: Exception) { toast(ctx, e.message ?: t(R.string.err_generic)) }
                }
            }
        )
    }

    if (inviteDialog) InviteTypeDialog(onDismiss = { inviteDialog = false }) { type ->
        val pid = personId ?: return@InviteTypeDialog
        inviteDialog = false
        scope.launch {
            try { invite = Repo.invite(pid, type); screen = "invite" }
            catch (e: Exception) { toast(ctx, e.message ?: t(R.string.err_generic)) }
        }
    }

    if (deleteKeyAsk) AlertDialog(
        onDismissRequest = { deleteKeyAsk = false },
        title = { Text(t(R.string.delete_key_q)) },
        text = { Text(t(R.string.delete_key_text)) },
        confirmButton = {
            TextButton(onClick = {
                deleteKeyAsk = false
                val pid = personId ?: return@TextButton
                scope.launch {
                    try { Repo.deleteKey(pid); me = me?.copy(hasKey = false); toast(ctx, t(R.string.key_deleted)) }
                    catch (e: Exception) { toast(ctx, e.message ?: t(R.string.err_generic)) }
                }
            }) { Text(t(R.string.delete), color = C.Alert) }
        },
        dismissButton = { TextButton(onClick = { deleteKeyAsk = false }) { Text(t(R.string.cancel)) } },
        containerColor = C.Surface
    )
}

@Composable
fun BottomBar(tab: String, onSelect: (String) -> Unit) {
    Column(Modifier.fillMaxWidth().background(C.Surface)) {
        Box(Modifier.fillMaxWidth().height(1.dp).background(C.Line))
        Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 6.dp)) {
            Tab.entries.forEach { item ->
                val sel = item.key == tab
                Column(
                    Modifier.weight(1f).clip(RoundedCornerShape(14.dp)).clickable { onSelect(item.key) }.padding(vertical = 8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Box(Modifier.width(28.dp).height(3.dp).clip(RoundedCornerShape(2.dp)).background(if (sel) C.Sys else Color.Transparent))
                    Spacer(Modifier.height(6.dp))
                    Text(
                        t(item.label), color = if (sel) C.Ink else C.Muted, fontSize = 13.sp, maxLines = 1,
                        fontWeight = if (sel) FontWeight.SemiBold else FontWeight.Normal
                    )
                }
            }
        }
    }
}

/* ---------------- Common UI elements ---------------- */

@Composable
fun Panel(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier.fillMaxWidth().padding(vertical = 5.dp).clip(RoundedCornerShape(22.dp))
            .background(C.Surface).border(1.dp, C.Line, RoundedCornerShape(22.dp)).padding(horizontal = 18.dp, vertical = 14.dp),
        content = content
    )
}

@Composable
fun BigButton(
    text: String, color: Color = C.Sys, textColor: Color = Color.White, enabled: Boolean = true,
    modifier: Modifier = Modifier, onClick: () -> Unit
) {
    Box(
        modifier.fillMaxWidth().padding(vertical = 6.dp).height(58.dp).clip(RoundedCornerShape(18.dp))
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
fun BpChart(list: List<Reading>, start: java.time.LocalDate, days: Int, modifier: Modifier, pulse: Boolean = true) {
    Canvas(modifier) {
        drawIntoCanvas { canvas ->
            drawBpChart(canvas.nativeCanvas, size.width, size.height, list, start, days, SCREEN_PAL, 11.sp.toPx(), pulse)
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

/** Shown over the app while it is locked: the logo and one button that opens fingerprint, face or screen lock. */
@Composable
fun LockScreen(onUnlock: () -> Unit) {
    Column(
        Modifier.fillMaxSize().background(C.Bg)
            // take every touch, so nothing underneath can be used while locked
            .pointerInput(Unit) { awaitPointerEventScope { while (true) awaitPointerEvent().changes.forEach { it.consume() } } }
            .padding(32.dp),
        verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally
    ) {
        HintLogo(56.dp)
        Spacer(Modifier.height(16.dp))
        Text("HINT", color = C.Ink, fontSize = 22.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 3.sp)
        Text(t(R.string.lock_text), color = C.Muted, fontSize = 14.sp, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 8.dp, bottom = 20.dp))
        BigButton(t(R.string.lock_unlock), onClick = onUnlock)
    }
}

@Composable
fun SetupScreen(onDone: (String) -> Unit) {
    var code by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var err by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val qrScan = rememberLauncherForActivityResult(ScanContract()) { res ->
        res.contents?.let { code = it.trim(); err = null }
    }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.Center) {
        Text(t(R.string.app_name), color = C.Ink, fontSize = 28.sp, fontWeight = FontWeight.ExtraLight)
        EcgLine(Modifier.padding(vertical = 8.dp))
        Text(t(R.string.setup_intro), color = C.Muted, fontSize = 15.sp)
        Spacer(Modifier.height(20.dp))
        OutlinedTextField(
            value = code, onValueChange = { code = it.trim() }, singleLine = true,
            label = { Text(t(R.string.family_or_invite_code)) },
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
        BigButton(t(R.string.scan_qr), color = C.Surface2, textColor = C.Ink, enabled = !busy) {
            qrScan.launch(
                ScanOptions().setDesiredBarcodeFormats(ScanOptions.QR_CODE).setPrompt(t(R.string.scan_qr_prompt))
                    .setBeepEnabled(false).setOrientationLocked(false)
            )
        }
        err?.let { Text(it, color = C.Alert, modifier = Modifier.padding(top = 8.dp)) }
        Spacer(Modifier.height(18.dp))
        Text(t(R.string.setup_privacy), color = C.Muted, fontSize = 13.sp)
    }
}

/* ---------------- Blood pressure tab ---------------- */

@Composable
fun HomeScreen(
    readings: List<Reading>, message: String?, me: Me?, onOpenCredit: () -> Unit, onAddKey: () -> Unit,
    onMeasure: () -> Unit, onVoice: () -> Unit, onDelete: (Reading) -> Unit
) {
    var toDelete by remember { mutableStateOf<Reading?>(null) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 18.dp, vertical = 12.dp)) {
        BrandHeader()

        // a friend who pays for their own photos has no key yet
        if (me != null && me.selfPays && !me.hasKey) WarnLine(t(R.string.key_missing_banner), onAddKey)
        // one short warning line, only when the credit is low or used up
        val c = me?.credit
        if (c != null && c.configured && c.low) WarnLine(t(R.string.credit_warn_low), onOpenCredit)
        if (message != null) Panel { Text(message, color = C.Alert, fontSize = 14.sp) }

        // photo of the display, or the microphone next to it to say the values aloud
        Row(verticalAlignment = Alignment.CenterVertically) {
            BigButton(t(R.string.measure), modifier = Modifier.weight(1f), onClick = onMeasure)
            Spacer(Modifier.width(10.dp))
            Box(
                Modifier.size(58.dp).clip(RoundedCornerShape(18.dp)).background(C.Surface2).clickable(onClick = onVoice),
                contentAlignment = Alignment.Center
            ) {
                Icon(painterResource(R.drawable.ic_mic), contentDescription = t(R.string.voice_button), tint = C.Ink, modifier = Modifier.size(26.dp))
            }
        }
        Text(t(R.string.photo_tip) + " " + t(R.string.voice_tip), color = C.Muted, fontSize = 13.sp, modifier = Modifier.padding(start = 4.dp, end = 4.dp, bottom = 6.dp))

        LastPanel(readings.lastOrNull())
        WeekPanel(readings)
        SummaryPanel(readings.filter { !Z.date(it.takenAt).isBefore(Z.today().minusDays(6)) })

        val today = Z.today()
        val week = readings.filter { !Z.date(it.takenAt).isBefore(today.minusDays(6)) }
        Panel {
            Row { Text(t(R.string.chart_title), color = C.Ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f)); Text(t(R.string.n_readings, week.size), color = C.Muted, fontSize = 13.sp) }
            Spacer(Modifier.height(10.dp))
            BpChart(week, today.minusDays(6), 7, Modifier.fillMaxWidth().height(180.dp), pulse = false)
            Legend(pulse = false)
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
                        if (r.source == "voice") Text("  · " + t(R.string.source_voice).lowercase(), color = C.Muted, fontSize = 12.sp)
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

/** The last reading, large: systolic above, diastolic below, pulse on the right. No judgement on the values. */
@Composable
fun LastPanel(last: Reading?) {
    Panel {
        if (last == null) {
            Text(t(R.string.no_readings_title), color = C.Ink, fontSize = 20.sp)
            Text(t(R.string.no_readings_text), color = C.Muted, fontSize = 14.sp)
        } else {
            Text(t(R.string.last_fmt, Z.whenText(last.takenAt)), color = C.Muted, fontSize = 14.sp)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("${last.sis}", color = C.Sys, fontSize = 64.sp, fontWeight = FontWeight.ExtraLight, lineHeight = 66.sp)
                    EcgLine()
                    Text("${last.dia}", color = C.Dia, fontSize = 64.sp, fontWeight = FontWeight.ExtraLight, lineHeight = 66.sp)
                    Text(t(R.string.mmhg_hint), color = C.Muted, fontSize = 12.sp)
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(last.pul?.toString() ?: "—", color = C.Pul, fontSize = 32.sp, fontWeight = FontWeight.Light)
                    Text(t(R.string.pulse_lower), color = C.Muted, fontSize = 12.sp)
                }
            }
        }
    }
}

/** One short amber line that opens where the problem is fixed. */
@Composable
fun WarnLine(text: String, onClick: () -> Unit) {
    val col = Color(WARN_COLOR)
    Box(
        Modifier.fillMaxWidth().padding(vertical = 4.dp).clip(RoundedCornerShape(14.dp)).background(col.copy(alpha = 0.15f))
            .clickable(onClick = onClick).padding(horizontal = 14.dp, vertical = 10.dp)
    ) {
        Text(text, color = col, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
fun Legend(pulse: Boolean = true) {
    Row(Modifier.padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        listOfNotNull(t(R.string.legend_sys) to C.Sys, t(R.string.legend_dia) to C.Dia, if (pulse) t(R.string.label_pul) to C.Pul else null).forEach { (label, col) ->
            Box(Modifier.size(9.dp).clip(RoundedCornerShape(2.dp)).background(col))
            Text(" $label   ", color = C.Muted, fontSize = 12.sp)
        }
    }
    Text(t(R.string.chart_daily), color = C.Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 2.dp))
}

/**
 * The last 7 days, today included (today in the last column): one column per day with one value per day,
 * the average of all that day's readings (systolic above, diastolic below), and a row with the average pulse.
 */
@Composable
fun WeekPanel(readings: List<Reading>) {
    val today = Z.today()
    val days = (6 downTo 0).map { today.minusDays(it.toLong()) }
    val byDay = days.associateWith { d -> readings.filter { Z.date(it.takenAt) == d } }
    val cell = Modifier.padding(horizontal = 1.dp).clip(RoundedCornerShape(6.dp)).background(C.Surface2).padding(vertical = 4.dp)
    val labelW = 52.dp
    Panel {
        Row { Text(t(R.string.last7), color = C.Ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f)); Text(t(R.string.n_readings, byDay.values.sumOf { it.size }), color = C.Muted, fontSize = 13.sp) }
        Spacer(Modifier.height(8.dp))
        Row(Modifier.fillMaxWidth()) {
            Spacer(Modifier.width(labelW))
            days.forEach { d ->
                Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(Z.weekday(d).trimEnd('.'), color = C.Muted, fontSize = 11.sp, maxLines = 1)
                    Text("${d.dayOfMonth}", color = if (d == today) C.Sys else C.Ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
        WeekRow("mmHg", labelW) {
            days.forEach { d ->
                val l = byDay.getValue(d)
                Column(Modifier.weight(1f).then(cell), horizontalAlignment = Alignment.CenterHorizontally) {
                    if (l.isEmpty()) {
                        Text("·", color = C.Muted, fontSize = 13.sp)
                        Text(" ", fontSize = 13.sp)
                    } else {
                        Text("${l.map { it.sis }.average().roundToInt()}", color = C.Sys, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
                        Text("${l.map { it.dia }.average().roundToInt()}", color = C.Dia, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
                    }
                }
            }
        }
        WeekRow(t(R.string.label_pul), labelW) {
            days.forEach { d ->
                val pul = byDay.getValue(d).mapNotNull { it.pul }
                Text(
                    if (pul.isEmpty()) "·" else "${pul.average().roundToInt()}", color = if (pul.isEmpty()) C.Muted else C.Pul,
                    fontSize = 13.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center, maxLines = 1,
                    modifier = Modifier.weight(1f).then(cell)
                )
            }
        }
        Text(t(R.string.week_hint), color = C.Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp))
    }
}

/** Summary of the last 7 days: the highest value and the average of systolic, diastolic and pulse. */
@Composable
fun SummaryPanel(week: List<Reading>) {
    fun avg(l: List<Int>) = if (l.isEmpty()) "—" else "${l.average().roundToInt()}"
    val sis = week.map { it.sis }
    val dia = week.map { it.dia }
    val pul = week.mapNotNull { it.pul }
    val labelW = 72.dp
    Panel {
        Text(t(R.string.summary_title), color = C.Ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(6.dp))
        Row(Modifier.fillMaxWidth()) {
            Spacer(Modifier.width(labelW))
            listOf(t(R.string.legend_sys), t(R.string.legend_dia), t(R.string.label_pul)).forEach {
                Text(it, color = C.Muted, fontSize = 12.sp, textAlign = TextAlign.Center, maxLines = 1, modifier = Modifier.weight(1f))
            }
        }
        listOf(
            t(R.string.summary_highest) to listOf(sis.maxOrNull()?.toString() ?: "—", dia.maxOrNull()?.toString() ?: "—", pul.maxOrNull()?.toString() ?: "—"),
            t(R.string.summary_avg) to listOf(avg(sis), avg(dia), avg(pul))
        ).forEach { (label, values) ->
            WeekRow(label, labelW) {
                values.zip(listOf(C.Sys, C.Dia, C.Pul)).forEach { (v, col) ->
                    Text(
                        v, color = if (v == "—") C.Muted else col, fontSize = 20.sp, fontWeight = FontWeight.Light, textAlign = TextAlign.Center, maxLines = 1,
                        modifier = Modifier.weight(1f).padding(horizontal = 2.dp).clip(RoundedCornerShape(8.dp)).background(C.Surface2).padding(vertical = 4.dp)
                    )
                }
            }
        }
    }
}

/**
 * The app's logo, the same as the launcher icon: coral ECG trace on the app's navy,
 * here scrolling from right to left like on a heart monitor.
 */
@Composable
fun HintLogo(size: Dp = 30.dp) {
    val shift by rememberInfiniteTransition(label = "ecg").animateFloat(
        0f, 1f, infiniteRepeatable(tween(2200, easing = LinearEasing)), label = "shift"
    )
    Canvas(
        Modifier.size(size).clip(RoundedCornerShape(size * 0.28f))
            .background(Brush.verticalGradient(listOf(C.Surface2, C.Bg))).border(1.dp, C.Line, RoundedCornerShape(size * 0.28f))
    ) {
        // launcher trace from x 13 to 95 in a 108 box; both ends at the same height, so copies join seamlessly
        val pts = listOf(13f to 57.2f, 33.5f to 57.2f, 38.9f to 49.7f, 44.3f to 57.2f, 48.6f to 57.2f, 55.1f to 27f,
            62.1f to 84.2f, 68f to 57.2f, 74.5f to 57.2f, 79.9f to 51.8f, 85.3f to 57.2f, 95f to 57.2f)
        val period = 82f
        val k = this.size.width / period
        val trace = Path()
        for (copy in 0..1) pts.forEachIndexed { i, (x, y) ->
            val px = (x - 13f + period * copy - shift * period) * k
            val py = (y - 57.2f) * k * 0.9f + this.size.height / 2f
            if (copy == 0 && i == 0) trace.moveTo(px, py) else trace.lineTo(px, py)
        }
        drawPath(trace, C.Sys, style = Stroke(width = size.toPx() * 0.045f, cap = StrokeCap.Round, join = StrokeJoin.Round))
    }
}

/** Home title: logo, the HINT wordmark and the full name in small capitals-like spacing. */
@Composable
fun BrandHeader() {
    Row(Modifier.fillMaxWidth().padding(top = 6.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        HintLogo()
        Spacer(Modifier.width(10.dp))
        Column {
            Text("HINT", color = C.Ink, fontSize = 18.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 3.sp, lineHeight = 20.sp)
            Text(t(R.string.app_name), color = C.Muted, fontSize = 11.sp, letterSpacing = 0.5.sp, lineHeight = 13.sp)
        }
    }
}

@Composable
private fun WeekRow(label: String, labelW: Dp, cells: @Composable RowScope.() -> Unit) {
    Row(Modifier.fillMaxWidth().padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, color = C.Muted, fontSize = 12.sp, maxLines = 1, modifier = Modifier.width(labelW))
        cells()
    }
}

/* ---------------- Photo reading ---------------- */

@Composable
fun ScanScreen(
    state: ScanState, saving: Boolean, onSave: (ScanResult) -> Unit, onRetake: () -> Unit,
    onRecharge: () -> Unit, onReplaceKey: () -> Unit, onCancel: () -> Unit
) {
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
                when (state.code) {
                    "anthropic_no_credit" -> BigButton(t(R.string.recharge), onClick = onRecharge)
                    // a friend's own key or credit: never the app manager's as a fallback
                    "friend_no_credit" -> {
                        BigButton(t(R.string.recharge), onClick = onRecharge)
                        BigButton(t(R.string.replace_key), color = C.Surface2, textColor = C.Ink, onClick = onReplaceKey)
                    }
                    "friend_key_invalid", "friend_no_key" -> {
                        BigButton(t(R.string.replace_key), onClick = onReplaceKey)
                        BigButton(t(R.string.recharge), color = C.Surface2, textColor = C.Ink, onClick = onRecharge)
                    }
                    else -> BigButton(t(R.string.retake), onClick = onRetake)
                }
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
                        Text(Z.whenText(r.takenAt), color = C.Ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                        Text(t(R.string.period_fmt, periodLabel(r.period)), color = C.Muted, fontSize = 13.sp)
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

/**
 * Values understood from speech, full screen like a photo reading: nothing is saved until the person taps Save.
 * Date and time are those of the moment the values were said.
 */
@Composable
fun VoiceScreen(
    values: Triple<Int, Int, Int?>, spokenAt: Long, unusual: List<String>, saving: Boolean,
    onSave: () -> Unit, onRetry: () -> Unit, onCancel: () -> Unit
) {
    val (sis, dia, pul) = values
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 18.dp, vertical = 12.dp)) {
        Header(t(R.string.new_reading), t(R.string.voice_sub), t(R.string.cancel), onCancel)
        Panel {
            Row(Modifier.fillMaxWidth()) {
                ValueBox(t(R.string.legend_sys), "$sis", C.Sys, Modifier.weight(1f))
                ValueBox(t(R.string.legend_dia), "$dia", C.Dia, Modifier.weight(1f))
                ValueBox(t(R.string.label_pul), pul?.toString() ?: "—", C.Pul, Modifier.weight(1f))
            }
            Spacer(Modifier.height(12.dp))
            Text(Z.whenText(spokenAt), color = C.Ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
            Text(t(R.string.voice_when), color = C.Muted, fontSize = 13.sp)
            // possible but strange values: in amber, so a misheard number is noticed before saving
            if (unusual.isNotEmpty()) {
                Text(
                    t(R.string.voice_check) + "\n" + unusual.joinToString("\n") { "• $it" },
                    color = Color(WARN_COLOR), fontSize = 13.sp, modifier = Modifier.padding(top = 10.dp)
                )
            }
        }
        Text(t(R.string.check_voice), color = C.Muted, fontSize = 14.sp, modifier = Modifier.padding(vertical = 6.dp))
        BigButton(if (saving) t(R.string.saving) else t(R.string.save), enabled = !saving, onClick = onSave)
        BigButton(t(R.string.voice_retry), color = C.Surface2, textColor = C.Ink, enabled = !saving, onClick = onRetry)
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
fun ReportScreen(readings: List<Reading>) {
    val ctx = LocalContext.current
    var n by rememberSaveable { mutableIntStateOf(7) }
    val infos = listOf(7, 15, 30).associateWith { periodInfo(readings, it) }
    val per = infos.getValue(n)
    val st = stats(per.list)

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 18.dp, vertical = 12.dp)) {
        Header(t(R.string.report_title), t(R.string.report_sub))

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
        }

        Spacer(Modifier.height(8.dp))
        if (!per.ok) Text(t(R.string.report_not_yet, n, per.missing), color = C.Muted, fontSize = 14.sp)
        BigButton(t(R.string.send_pdf), enabled = per.ok) {
            try { shareFile(ctx, buildPdf(ctx, readings, n), "application/pdf") } catch (e: Exception) { toast(ctx, t(R.string.file_failed, e.message ?: "")) }
        }
        BigButton(t(R.string.send_excel), color = C.Surface2, textColor = C.Ink, enabled = per.ok) {
            try { shareFile(ctx, buildCsv(ctx, readings, n), "text/csv") } catch (e: Exception) { toast(ctx, t(R.string.file_failed, e.message ?: "")) }
        }
        Spacer(Modifier.height(24.dp))
    }
}


/* ---------------- Credit tab ---------------- */

@Composable
fun CreditScreen(
    me: Me?, onRecharge: () -> Unit, onCorrect: () -> Unit,
    onInvite: () -> Unit, onKey: () -> Unit, onDeleteKey: () -> Unit
) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 18.dp, vertical = 12.dp)) {
        Header(t(R.string.credit_page_title))
        if (me == null) {
            Panel { Text("…", color = C.Muted) }
            return@Column
        }
        val c = me.credit
        val set = c != null && c.configured
        val col = if (set && c!!.low) Color(WARN_COLOR) else C.Ink
        Panel {
            Text(t(R.string.credit_money_left), color = C.Muted, fontSize = 14.sp)
            Text(if (set) usd(maxOf(0.0, c!!.remaining ?: 0.0)) else "—", color = col, fontSize = 40.sp, fontWeight = FontWeight.Light)
            Spacer(Modifier.height(10.dp))
            Text(t(R.string.credit_photos_can), color = C.Muted, fontSize = 14.sp)
            Text(if (set) "${c!!.photosLeft ?: 0}" else "—", color = col, fontSize = 40.sp, fontWeight = FontWeight.Light)
            Spacer(Modifier.height(10.dp))
            Text(t(R.string.credit_avg_fmt, usdFine(c?.avgCost ?: 0.006)), color = C.Muted, fontSize = 13.sp)
            if (!set) Text(
                if (me.canRecharge) t(R.string.credit_not_set_admin) else t(R.string.credit_not_set_user),
                color = C.Muted, fontSize = 13.sp, modifier = Modifier.padding(top = 6.dp)
            )
            if (me.selfPays) Text(t(R.string.credit_own_note), color = C.Muted, fontSize = 13.sp, modifier = Modifier.padding(top = 6.dp))
        }
        if (me.selfPays && !me.hasKey) {
            Panel { Text(t(R.string.key_missing), color = C.Ink, fontSize = 15.sp) }
            BigButton(t(R.string.add_my_key), onClick = onKey)
        }
        BigButton(t(R.string.recharge), onClick = onRecharge)
        if (me.canRecharge) {
            TextButton(onClick = onCorrect, modifier = Modifier.fillMaxWidth()) {
                Text(t(R.string.correct_link), color = C.Muted, fontSize = 13.sp, textAlign = TextAlign.Center)
            }
        }
        if (me.selfPays && me.hasKey) {
            BigButton(t(R.string.replace_key), color = C.Surface2, textColor = C.Ink, onClick = onKey)
            TextButton(onClick = onDeleteKey, modifier = Modifier.fillMaxWidth()) {
                Text(t(R.string.delete_key), color = C.Muted, fontSize = 13.sp, textAlign = TextAlign.Center)
            }
        }
        if (me.isAdmin) {
            Spacer(Modifier.height(10.dp))
            BigButton(t(R.string.invite_someone), color = C.Surface2, textColor = C.Ink, onClick = onInvite)
            Text(t(R.string.invite_note), color = C.Muted, fontSize = 13.sp, modifier = Modifier.padding(horizontal = 4.dp))
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
fun AmountDialog(title: String, onDismiss: () -> Unit, onSave: (Double) -> Unit) {
    val ctx = LocalContext.current
    var text by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = { AmountField(text) { text = it } },
        confirmButton = {
            TextButton(onClick = {
                val v = text.replace(',', '.').toDoubleOrNull()
                if (v == null || v <= 0.0) toast(ctx, t(R.string.enter_amount)) else onSave(v)
            }) { Text(t(R.string.confirm), color = C.Sys) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(t(R.string.cancel)) } },
        containerColor = C.Surface
    )
}

@Composable
fun AmountField(value: String, onChange: (String) -> Unit) {
    OutlinedTextField(
        value = value, onValueChange = { txt -> onChange(txt.filter { it.isDigit() || it == ',' || it == '.' }.take(7)) },
        singleLine = true, label = { Text(t(R.string.amount_usd)) },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
        colors = OutlinedTextFieldDefaults.colors(focusedTextColor = C.Ink, unfocusedTextColor = C.Ink, focusedBorderColor = C.Sys, unfocusedBorderColor = C.Line),
        modifier = Modifier.fillMaxWidth()
    )
}
