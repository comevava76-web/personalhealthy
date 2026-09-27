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
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.fillMaxHeight
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
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
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
import androidx.compose.ui.draw.drawBehind
import kotlinx.coroutines.flow.first
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
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
    val Sys = Color(0xFF8C7BF2)   // systolic, violet (no red anywhere: red would read as "a problem")
    val Dia = Color(0xFF1FA396)   // diastolic, teal
    val Pul = Color(0xFFC08A1E)   // pulse, amber
    val Alert = Color(0xFFF0A35E)   // errors and deleting: warm orange, not red
}

class MainActivity : FragmentActivity() {
    // App lock: fingerprint, face or the phone's own screen lock (no separate PIN).
    // Locked at start and after more than LOCK_AFTER_MS away from the app.
    private var locked by mutableStateOf(true)
    private var hiddenAt = 0L
    private var asking = false   // the fingerprint / screen-lock window is open
    private var dismissed = false // the person closed that window (back): wait for the Unlock button
    private lateinit var prompt: BiometricPrompt

    private fun lockAvailable(): Boolean =
        getSharedPreferences("battito", Context.MODE_PRIVATE).getString("personId", null) != null &&
            BiometricManager.from(this).canAuthenticate(LOCK_AUTH) == BiometricManager.BIOMETRIC_SUCCESS

    /**
     * [fromButton]: the Unlock button always opens the window again, at the first tap. Any window still
     * closing is cancelled first, and the new one opens a moment later: the biometric library ignores a
     * request made while the previous window is still going away, which needed several taps before.
     */
    fun unlock(fromButton: Boolean = false) {
        if (!lockAvailable()) { locked = false; return }
        if (fromButton) {
            dismissed = false
            asking = false
            prompt.cancelAuthentication()
            window.decorView.postDelayed({ if (locked && !asking) showPrompt() }, 350)
            return
        }
        if (asking || dismissed) return
        showPrompt()
    }

    private fun showPrompt() {
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
        dismissed = false   // next time the app is opened, ask again by itself
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
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                asking = false; dismissed = false; locked = false
            }
            // closed with back, cancelled or too many attempts: stays locked, and does not reopen by itself
            // (it would come back at once after back); the Unlock button opens it again
            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                asking = false
                dismissed = true
            }
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
                    if (locked) LockScreen { unlock(fromButton = true) }
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

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun App() {
    val ctx = LocalContext.current
    val prefs = remember { ctx.getSharedPreferences("battito", Context.MODE_PRIVATE) } // keep: existing storage name
    var personId by remember { mutableStateOf(prefs.getString("personId", null)) }
    // "tabs", or a full screen without the bottom bar: "scan", "voice", "listen", "key" (own Anthropic key), "all"
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
    var scanNeedsKey by remember { mutableStateOf(false) }   // Scan tapped without an AI key: say it is optional
    var keyBusy by remember { mutableStateOf(false) }
    var keyError by remember { mutableStateOf<ApiException?>(null) }
    var deleteKeyAsk by remember { mutableStateOf(false) }
    var linkAsk by remember { mutableStateOf(false) }   // linking Google: the privacy note is on screen
    val scope = rememberCoroutineScope()

    val photoFile = remember { File(File(ctx.cacheDir, "photos").apply { mkdirs() }, "scan.jpg") }
    val photoUri = remember { FileProvider.getUriForFile(ctx, ctx.packageName + ".files", photoFile) }

    // the notice is binding and accepted once per installed version: at the first installation, after every update
    // of the app and whenever its text changes. Remembered as "text version @ app version".
    val noticeKey = DISCLAIMER_VERSION + "@" + BuildConfig.VERSION_CODE
    var noticeLocal by remember { mutableStateOf(prefs.getString("noticeAccepted", null)) }
    var noticeBusy by remember { mutableStateOf(false) }
    var checkingAi by remember { mutableStateOf(false) }
    val needsNotice = noticeLocal != noticeKey

    // switched off remotely: remembered, so that without a connection the app stays closed too
    LaunchedEffect(Unit) {
        if (prefs.getInt("appOff", 0) == BuildConfig.VERSION_CODE) AppGate.disabled = true
    }
    LaunchedEffect(AppGate.disabled) {
        if (AppGate.disabled) prefs.edit().putInt("appOff", BuildConfig.VERSION_CODE).apply()
    }
    fun checkAppGate() = scope.launch {
        when (Repo.appAllowed()) {
            false -> AppGate.disabled = true
            true -> if (AppGate.disabled) { AppGate.disabled = false; prefs.edit().remove("appOff").apply() }
            null -> {}
        }
        Unit
    }

    fun reload() {
        val pid = personId ?: return
        scope.launch {
            loading = true
            try {
                val l = Repo.list(pid)
                readings.clear(); readings.addAll(l); message = null
                var m = Repo.me(pid)
                me = m
                if (!m.sub.blocked) AppGate.subExpired = false
                // Scan follows what Anthropic answers, not the estimate: checked again if the last check is over an hour old
                if (m.selfPays && m.hasKey && (m.aiCheckedAt == null || System.currentTimeMillis() - m.aiCheckedAt!! > 3_600_000L)) {
                    try { Repo.checkAi(pid); m = Repo.me(pid); me = m } catch (_: Exception) { }
                }
                // first start without an AI key: once, the welcome that explains voice (free) and scanning (optional)
                if (m.selfPays && !m.hasKey && !prefs.getBoolean("welcomeShown", false) && screen == "tabs") {
                    prefs.edit().putBoolean("welcomeShown", true).apply()
                    screen = "welcome"
                }
                // a friend without a key yet: straight to the guided steps (once; later from the Credit tab)
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
                // Anthropic refused (no credit, key refused): the server stored it, the Scan button switches off
                val code = (e as? ApiException)?.code
                if (code == "friend_no_credit" || code == "friend_key_invalid") reload()
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
    // the yearly subscription: Google Play's answers come back here
    LaunchedEffect(Unit) {
        Billing.onChanged = { reload() }
        Billing.onError = { m -> toast(ctx, m) }
    }
    // the server said it has run out: fetch the account again, the invitation to renew follows from it
    LaunchedEffect(AppGate.subExpired) { if (AppGate.subExpired) reload() }
    // not paid (or run out): read the price and hand the server a renewal already made on Google Play
    LaunchedEffect(personId, me?.sub?.blocked) {
        val pid = personId
        if (pid != null && me?.sub?.blocked == true) try { Billing.restore(ctx, pid) } catch (_: Exception) { }
    }

    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            // back in the app: fresh readings and credit (there is no refresh button)
            if (event == Lifecycle.Event.ON_RESUME) checkAppGate()
            if (event == Lifecycle.Event.ON_RESUME && !loading) reload()
            if (event == Lifecycle.Event.ON_RESUME && rechargePending) {
                rechargePending = false
                // after a top-up on Anthropic: check with Anthropic again, Scan follows the answer
                val pid = personId
                if (pid != null && me?.hasKey == true) scope.launch { try { Repo.checkAi(pid); reload() } catch (_: Exception) { } }
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
    fun launchCamera() {
        try { camera.launch(photoUri) }
        catch (e: ActivityNotFoundException) { toast(ctx, t(R.string.no_camera)) }
        catch (e: SecurityException) { toast(ctx, t(R.string.camera_permission)) }
    }
    // The QR scanner library adds the camera permission to the app; once it is declared, Android lets the app open
    // the phone's camera only after the person has allowed it (otherwise the app would close). So: ask first.
    val cameraPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
        if (ok) launchCamera() else toast(ctx, t(R.string.camera_permission))
    }
    fun openCamera() {
        if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) launchCamera()
        else cameraPermission.launch(Manifest.permission.CAMERA)
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
            // a version switched off remotely: only the way to the latest one
            AppGate.disabled -> AppOffScreen()
            personId == null -> SetupScreen { pid ->
                prefs.edit().putString("personId", pid).apply()
                personId = pid
            }
            // the notice comes before anything else: without acceptance the app does not open
            needsNotice -> DisclaimerScreen(
                busy = noticeBusy,
                onAccept = {
                    val pid = personId ?: return@DisclaimerScreen
                    noticeBusy = true
                    scope.launch {
                        try {
                            val info = ctx.packageManager.getPackageInfo(ctx.packageName, 0)
                            Repo.acceptNotice(
                                pid, DISCLAIMER_VERSION, t(R.string.disc_lang), t(R.string.disc_title) + "\n\n" + t(R.string.disc_body),
                                info.versionName ?: "", Build.MANUFACTURER + " " + Build.MODEL
                            )
                            prefs.edit().putString("noticeAccepted", noticeKey).apply()
                            noticeLocal = noticeKey
                            reload()
                        } catch (e: Exception) { toast(ctx, e.message ?: t(R.string.err_generic)) }
                        noticeBusy = false
                    }
                },
                onDecline = {
                    toast(ctx, t(R.string.disc_declined))
                    (ctx as? android.app.Activity)?.finishAndRemoveTask()
                }
            )
            // no valid subscription: only the courteous invitation to renew (the terms can still be read)
            (me?.sub?.blocked == true || AppGate.subExpired) && screen != "terms" -> SubscribeScreen(
                expired = me?.sub?.until != null,
                price = Billing.price, busy = Billing.busy,
                onBuy = { val pid = personId; val act = ctx as? android.app.Activity; if (pid != null && act != null) Billing.buy(act, pid) },
                onManage = { try { ctx.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(Billing.MANAGE_URL))) } catch (_: Exception) { toast(ctx, t(R.string.no_browser)) } },
                onTerms = { screen = "terms" }
            )
            // the terms accepted at the start, to read again from the colophon
            screen == "terms" -> DisclaimerScreen(busy = false, onAccept = {}, onDecline = {}, onClose = { screen = "tabs" })
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
            screen == "key" || screen == "welcome" -> KeyScreen(
                welcome = screen == "welcome",
                hasKey = me?.hasKey == true, busy = keyBusy, error = keyError?.message, errorCode = keyError?.code,
                onSave = { key, amount ->
                    val pid = personId ?: return@KeyScreen
                    keyBusy = true; keyError = null
                    scope.launch {
                        try {
                            val c = Repo.saveKey(pid, key, null)
                            // the server has just tested the key with Anthropic: Scan can switch on straight away
                            me = me?.copy(hasKey = true, credit = c ?: me?.credit, aiStatus = "ok", aiCheckedAt = System.currentTimeMillis())
                            reload()
                            toast(ctx, t(R.string.key_saved))
                            screen = "tabs"
                        } catch (e: Exception) { keyError = e as? ApiException ?: ApiException("generic") }
                        finally { keyBusy = false }
                    }
                },
                onRecharge = { openRecharge() },
                onLater = { screen = "tabs"; keyError = null }
            )
            screen == "all" -> AllReadingsScreen(
                readings = readings,
                onDelete = { r ->
                    val pid = personId ?: return@AllReadingsScreen
                    scope.launch {
                        try { Repo.delete(pid, r.id); toast(ctx, t(R.string.deleted)); reload() }
                        catch (e: Exception) { toast(ctx, e.message ?: t(R.string.err_generic)) }
                    }
                },
                onDeleteAll = {
                    val pid = personId ?: return@AllReadingsScreen
                    scope.launch {
                        try { Repo.deleteAll(pid); toast(ctx, t(R.string.reset_done)); screen = "tabs"; reload() }
                        catch (e: Exception) { toast(ctx, e.message ?: t(R.string.err_generic)) }
                    }
                },
                onClose = { screen = "tabs" }
            )
            else -> Column(Modifier.fillMaxSize()) {
                // pull down with the thumb: fresh readings, and the AI state checked again with Anthropic
                val pull = androidx.compose.material3.pulltorefresh.rememberPullToRefreshState()
                if (pull.isRefreshing) {
                    LaunchedEffect(true) {
                        val pid = personId
                        if (pid != null && me?.selfPays == true && me?.hasKey == true) try { Repo.checkAi(pid) } catch (_: Exception) { }
                        reload()
                        kotlinx.coroutines.delay(400)
                        androidx.compose.runtime.snapshotFlow { loading }.first { !it }
                        pull.endRefresh()
                    }
                }
                Box(Modifier.weight(1f).nestedScroll(pull.nestedScrollConnection)) {
                    when (tab) {
                        Tab.REPORT.key -> ReportScreen(readings, onTerms = { screen = "terms" }, onDash = {
                            val pid = personId ?: return@ReportScreen
                            scope.launch {
                                try {
                                    val url = Repo.webDashUrl(pid)
                                    ctx.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url)))
                                } catch (e: Exception) { toast(ctx, e.message ?: t(R.string.err_generic)) }
                            }
                        })
                        Tab.CREDIT.key -> CreditScreen(
                            onTerms = { screen = "terms" },
                            onSubscriptionOn = { on ->
                                val pid = personId ?: return@CreditScreen
                                scope.launch {
                                    try { Repo.setSubscriptionOn(pid, on); reload(); toast(ctx, t(R.string.versions_saved)) }
                                    catch (e: Exception) { toast(ctx, e.message ?: t(R.string.err_generic)) }
                                }
                            },
                            onAppMinVersion = { v ->
                                val pid = personId ?: return@CreditScreen
                                scope.launch {
                                    try { Repo.setAppMinVersion(pid, v); reload(); toast(ctx, t(R.string.versions_saved)) }
                                    catch (e: Exception) { toast(ctx, e.message ?: t(R.string.err_generic)) }
                                }
                            },
                            me = me, readingsCount = readings.size, onRecharge = { openRecharge() }, onCorrect = { amountDialog = "set" },
                            onKey = { openKeySteps() }, onDeleteKey = { deleteKeyAsk = true },
                            // after a recharge on Anthropic: ask Anthropic again, Scan follows the answer
                            checkingAi = checkingAi,
                            onCheckAi = {
                                val pid = personId ?: return@CreditScreen
                                checkingAi = true
                                scope.launch {
                                    try { Repo.checkAi(pid); reload() } catch (e: Exception) { toast(ctx, e.message ?: t(R.string.err_generic)) }
                                    checkingAi = false
                                }
                            },
                            onLinkGoogle = { linkAsk = true },
                            onManageReadings = { screen = "all" },
                            onSignOut = {
                                val pid = personId ?: return@CreditScreen
                                scope.launch {
                                    try {
                                        Repo.signOut(pid)
                                        prefs.edit().remove("personId").remove("googleEmail").apply()
                                        readings.clear(); me = null; personId = null
                                        toast(ctx, t(R.string.signed_out))
                                    } catch (e: Exception) { toast(ctx, e.message ?: t(R.string.err_generic)) }
                                }
                            },
                            onDeleteAccount = {
                                val pid = personId ?: return@CreditScreen
                                scope.launch {
                                    try {
                                        Repo.deleteAccount(pid)
                                        prefs.edit().remove("personId").remove("googleEmail").apply()
                                        readings.clear(); me = null; personId = null
                                        toast(ctx, t(R.string.account_deleted))
                                    } catch (e: Exception) { toast(ctx, e.message ?: t(R.string.err_generic)) }
                                }
                            }
                        )
                        else -> HomeScreen(
                            onTerms = { screen = "terms" },
                            readings = readings, message = message, me = me,
                            onOpenCredit = { tab = Tab.CREDIT.key }, onAddKey = { openKeySteps() },
                            // the photo reading is the only paid part: without a key, say so and offer the free voice
                            onMeasure = { if (me?.selfPays == true && me?.hasKey == false) scanNeedsKey = true else openCamera() },
                            onVoice = { openVoice() },
                        )
                    }
                    androidx.compose.material3.pulltorefresh.PullToRefreshContainer(
                        state = pull, modifier = Modifier.align(Alignment.TopCenter),
                        containerColor = C.Surface2, contentColor = C.Sys
                    )
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

    // link Google to this phone's account: the privacy note first, then Google's account chooser
    if (linkAsk) AlertDialog(
        onDismissRequest = { linkAsk = false },
        title = { Text(t(R.string.privacy_title)) },
        text = { Text(t(R.string.privacy_note)) },
        confirmButton = {
            TextButton(onClick = {
                linkAsk = false
                val pid = personId ?: return@TextButton
                scope.launch {
                    try {
                        val token = GoogleSignIn.idToken(ctx) ?: return@launch
                        val newPid = Repo.google(token, null, consent = true)
                        if (newPid != pid) { prefs.edit().putString("personId", newPid).apply(); personId = newPid }
                        toast(ctx, t(R.string.google_linked))
                        reload()
                    } catch (e: Exception) { toast(ctx, e.message ?: t(R.string.err_generic)) }
                }
            }) { Text(t(R.string.privacy_accept_link), color = C.Sys) }
        },
        dismissButton = { TextButton(onClick = { linkAsk = false }) { Text(t(R.string.cancel)) } },
        containerColor = C.Surface
    )

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

    if (scanNeedsKey) AlertDialog(
        onDismissRequest = { scanNeedsKey = false },
        title = { Text(t(R.string.scan_needs_key_title)) },
        text = { Text(t(R.string.scan_needs_key_text)) },
        confirmButton = { TextButton(onClick = { scanNeedsKey = false; openKeySteps() }) { Text(t(R.string.scan_needs_key_add), color = C.Sys) } },
        dismissButton = { TextButton(onClick = { scanNeedsKey = false; openVoice() }) { Text(t(R.string.scan_needs_key_voice)) } },
        containerColor = C.Surface
    )

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
    modifier: Modifier = Modifier, icon: Int? = null, trailing: Int? = null, onClick: () -> Unit
) {
    // switched off: clearly faded, background and text alike
    val fg = if (enabled) textColor else textColor.copy(alpha = 0.5f)
    Box(
        modifier.fillMaxWidth().padding(vertical = 6.dp).height(58.dp).clip(RoundedCornerShape(18.dp))
            .background(if (enabled) color else color.copy(alpha = 0.25f))
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (icon != null) {
                Icon(painterResource(icon), contentDescription = null, tint = fg, modifier = Modifier.size(22.dp))
                Spacer(Modifier.width(8.dp))
            }
            Text(text, color = fg, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
            if (trailing != null) {
                // the AI sign stays well visible even when the button is off
                Spacer(Modifier.width(8.dp))
                Icon(painterResource(trailing), contentDescription = null, tint = if (enabled) textColor else textColor.copy(alpha = 0.85f), modifier = Modifier.size(19.dp))
            }
        }
    }
}

/** The Web Dashboard button: a soft violet glow runs across it from left to right, again and again. */
@Composable
fun GlowButton(text: String, onClick: () -> Unit) {
    val x by rememberInfiniteTransition(label = "glow").animateFloat(
        -0.4f, 1.4f, infiniteRepeatable(tween(2600, easing = LinearEasing)), label = "x"
    )
    Box(
        Modifier.fillMaxWidth().padding(vertical = 6.dp).height(58.dp).clip(RoundedCornerShape(18.dp))
            .background(C.Surface2)
            .drawBehind {
                val w = size.width
                drawRect(Brush.horizontalGradient(
                    listOf(Color.Transparent, C.Sys.copy(alpha = 0.55f), Color.Transparent),
                    startX = x * w - w * 0.35f, endX = x * w + w * 0.35f
                ))
            }
            .border(1.dp, C.Sys.copy(alpha = 0.7f), RoundedCornerShape(18.dp))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Text(text, color = C.Ink, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
    }
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

/** One figure of the credit panel: a hairline above, the label on the left, the value on the right. */
@Composable
fun CreditRow(label: String, value: String) {
    Box(Modifier.fillMaxWidth().height(1.dp).background(C.Muted.copy(alpha = 0.18f)))
    Row(Modifier.fillMaxWidth().padding(vertical = 9.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, color = C.Muted, fontSize = 14.sp, modifier = Modifier.weight(1f))
        Text(value, color = C.Ink, fontSize = 16.sp, fontWeight = FontWeight.Medium, maxLines = 1)
    }
}

/** Title of a group of the Admin tab. */
@Composable
fun SectionTitle(text: String) {
    Text(text, color = C.Muted, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(start = 4.dp, top = 16.dp, bottom = 2.dp))
}

/** A row of boxes that all take the height of the tallest one. */
@Composable
fun StatRow(content: @Composable RowScope.() -> Unit) {
    Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), content = content)
}

@Composable
fun StatBox(label: String, value: String, note: String? = null, color: Color = C.Ink, modifier: Modifier = Modifier, period: String? = null) {
    Column(modifier.padding(4.dp).clip(RoundedCornerShape(16.dp)).background(C.Surface2).padding(12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (period != null) { PeriodIcon(period, 14.dp, bg = C.Surface2); Spacer(Modifier.width(6.dp)) }
            Text(label, color = C.Muted, fontSize = 12.sp)
        }
        Text(value, color = color, fontSize = 22.sp, fontWeight = FontWeight.Light)
        if (note != null) Text(note, color = C.Muted, fontSize = 12.sp)
    }
}

/* ---------------- Activation ---------------- */

/** Shown over the app while it is locked: the logo and one button that opens fingerprint, face or screen lock. */
@Composable
fun LockScreen(onUnlock: () -> Unit) {
    Box(Modifier.fillMaxSize()) {
    // Takes the touches that miss the button, so nothing of the app underneath can be used while locked.
    // It sits behind the content, not around it: wrapped around it, it also took the Unlock button's
    // touches and cancelled most taps (that is why Unlock needed 5-7 taps).
    Box(Modifier.matchParentSize().background(C.Bg).pointerInput(Unit) {
        awaitPointerEventScope { while (true) awaitPointerEvent().changes.forEach { it.consume() } }
    })
    Column(
        Modifier.fillMaxSize().padding(32.dp),
        verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally
    ) {
        HintLogo(56.dp)
        Spacer(Modifier.height(16.dp))
        Text("HINT 365", color = C.Ink, fontSize = 22.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 3.sp)
        Text(t(R.string.lock_text), color = C.Muted, fontSize = 14.sp, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 8.dp, bottom = 20.dp))
        BigButton(t(R.string.lock_unlock), onClick = onUnlock)
    }
    }
}

/** At the bottom of each tab: app version, copyright (the year updates itself) and the terms of use. */
@Composable
fun Colophon(onTerms: () -> Unit) {
    val ctx = LocalContext.current
    val version = remember { try { ctx.packageManager.getPackageInfo(ctx.packageName, 0).versionName ?: "" } catch (e: Exception) { "" } }
    val y = Z.today().year
    val years = if (y > 2026) "2026–$y" else "2026"
    Column(Modifier.fillMaxWidth().padding(top = 28.dp, bottom = 16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text("HINT 365 · HealthyInstantTracker · v$version", color = C.Muted, fontSize = 11.sp)
        Text(t(R.string.colophon_rights, years), color = C.Muted, fontSize = 11.sp)
        Text(
            t(R.string.disc_legal), color = C.Muted, fontSize = 11.sp,
            textDecoration = androidx.compose.ui.text.style.TextDecoration.Underline,
            modifier = Modifier.clickable(onClick = onTerms).padding(horizontal = 12.dp, vertical = 6.dp)
        )
    }
}

/** The notice, before first use: read it, tick the box, accept. Without acceptance the app closes. */
@Composable
fun DisclaimerScreen(busy: Boolean, onAccept: () -> Unit, onDecline: () -> Unit, onClose: (() -> Unit)? = null) {
    var read by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 18.dp, vertical = 12.dp)) {
        // read again later (onClose): only the text and Close; at the start: the text, the box and the two buttons
        if (onClose != null) Header(t(R.string.disc_title), null, t(R.string.close), onClose, titleSize = 22)
        else {
            BrandHeader()
            Text(t(R.string.disc_title), color = C.Ink, fontSize = 22.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(bottom = 6.dp))
        }
        // each part: a short title, then its text
        t(R.string.disc_body).split("\n\n").forEach { part ->
            val lines = part.split("\n", limit = 2)
            Panel {
                Text(lines[0], color = C.Ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                if (lines.size > 1) Text(lines[1], color = C.Ink.copy(alpha = 0.85f), fontSize = 14.sp, lineHeight = 20.sp, modifier = Modifier.padding(top = 4.dp))
            }
        }
        if (onClose == null) {
            Row(
                Modifier.fillMaxWidth().padding(top = 8.dp).clickable { read = !read },
                verticalAlignment = Alignment.CenterVertically
            ) {
                Checkbox(checked = read, onCheckedChange = { read = it }, colors = CheckboxDefaults.colors(checkedColor = C.Sys, uncheckedColor = C.Muted))
                Text(t(R.string.disc_check), color = C.Ink, fontSize = 14.sp)
            }
            BigButton(t(R.string.disc_accept), enabled = read && !busy, onClick = onAccept)
            TextButton(onClick = onDecline, modifier = Modifier.fillMaxWidth()) {
                Text(t(R.string.disc_decline), color = C.Muted, fontSize = 13.sp)
            }
        } else {
            // the same text on the web, where the providers' links can be opened
            val webCtx = LocalContext.current
            TextButton(onClick = {
                webCtx.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(TERMS_URL)))
            }, modifier = Modifier.fillMaxWidth()) { Text(t(R.string.disc_web), color = C.Sys, fontSize = 13.sp) }
        }
        Spacer(Modifier.height(24.dp))
    }
}

/** No valid subscription: a courteous invitation to subscribe or renew. The data wait on the server. */
@Composable
fun SubscribeScreen(expired: Boolean, price: String?, busy: Boolean, onBuy: () -> Unit, onManage: () -> Unit, onTerms: () -> Unit) {
    val p = price ?: t(R.string.sub_price_default)
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 18.dp, vertical = 12.dp)) {
        BrandHeader()
        Spacer(Modifier.height(24.dp))
        Text(t(if (expired) R.string.sub_title_expired else R.string.sub_title_new), color = C.Ink, fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
        Panel {
            Text(if (expired) t(R.string.sub_text_expired) else t(R.string.sub_text_new, p), color = C.Ink, fontSize = 15.sp, lineHeight = 21.sp)
            Text(t(R.string.sub_cancel_note), color = C.Muted, fontSize = 13.sp, lineHeight = 18.sp, modifier = Modifier.padding(top = 10.dp))
        }
        BigButton(t(if (expired) R.string.sub_renew else R.string.sub_buy, p), enabled = !busy, onClick = onBuy)
        if (expired) BigButton(t(R.string.sub_manage), color = C.Surface2, textColor = C.Ink, onClick = onManage)
        TextButton(onClick = onTerms, modifier = Modifier.fillMaxWidth()) { Text(t(R.string.disc_title), color = C.Muted, fontSize = 13.sp) }
    }
}

/** This version was switched off remotely: nothing works until the latest one is installed. The data stay on the server. */
@Composable
fun AppOffScreen() {
    val ctx = LocalContext.current
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 18.dp, vertical = 12.dp)) {
        BrandHeader()
        Spacer(Modifier.height(24.dp))
        Text(t(R.string.app_off_title), color = C.Ink, fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
        Panel { Text(t(R.string.app_off_text, BuildConfig.VERSION_NAME), color = C.Ink, fontSize = 15.sp, lineHeight = 21.sp) }
        BigButton(t(R.string.app_off_download)) {
            try { ctx.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(DOWNLOAD_URL))) }
            catch (_: Exception) { toast(ctx, t(R.string.no_browser)) }
        }
    }
}

@Composable
fun SetupScreen(onDone: (String) -> Unit) {
    if (GoogleSignIn.enabled) { GoogleSetupScreen(onDone); return }
    var code by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var err by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val qrScan = rememberLauncherForActivityResult(ScanContract()) { res ->
        res.contents?.let { code = it.trim(); err = null }
    }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.Center) {
        Text("HINT 365", color = C.Ink, fontSize = 28.sp, fontWeight = FontWeight.ExtraLight)
        EcgLine(Modifier.padding(vertical = 8.dp))
        Text(t(R.string.setup_intro), color = C.Muted, fontSize = 15.sp)
        Spacer(Modifier.height(20.dp))
        CodeField(code) { code = it }
        Spacer(Modifier.height(12.dp))
        BigButton(if (busy) t(R.string.activating) else t(R.string.activate), enabled = code.length >= 4 && !busy) {
            busy = true; err = null
            scope.launch {
                try { onDone(Repo.register(code)) } catch (e: Exception) { err = e.message } finally { busy = false }
            }
        }
        BigButton(t(R.string.scan_qr), color = C.Surface2, textColor = C.Ink, enabled = !busy) { scanQr(qrScan) }
        err?.let { Text(it, color = C.Alert, modifier = Modifier.padding(top = 8.dp)) }
        Spacer(Modifier.height(18.dp))
        Text(t(R.string.setup_privacy), color = C.Muted, fontSize = 13.sp)
    }
}

private fun scanQr(launcher: androidx.activity.result.ActivityResultLauncher<ScanOptions>) {
    launcher.launch(
        ScanOptions().setDesiredBarcodeFormats(ScanOptions.QR_CODE).setPrompt(t(R.string.scan_qr_prompt))
            .setBeepEnabled(false).setOrientationLocked(false)
    )
}

@Composable
private fun CodeField(code: String, onChange: (String) -> Unit) {
    OutlinedTextField(
        value = code, onValueChange = { onChange(it.trim()) }, singleLine = true,
        label = { Text(t(R.string.family_or_invite_code)) },
        keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.None),
        colors = OutlinedTextFieldDefaults.colors(focusedTextColor = C.Ink, unfocusedTextColor = C.Ink, focusedBorderColor = C.Sys, unfocusedBorderColor = C.Line),
        modifier = Modifier.fillMaxWidth()
    )
}

/**
 * First start with Sign in with Google: on their own, a new person creates their account, and someone with a new phone
 * finds their account again. Everyone pays their own photo readings with their own Anthropic key, set up right after
 * inside the app. After this, the app opens with fingerprint or face.
 */
@Composable
fun GoogleSetupScreen(onDone: (String) -> Unit) {
    val ctx = LocalContext.current
    var consent by rememberSaveable { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var err by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.Center) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            HintLogo(40.dp)
            Spacer(Modifier.width(12.dp))
            Column {
                Text("HINT 365", color = C.Ink, fontSize = 22.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 3.sp)
                Text(t(R.string.app_name), color = C.Muted, fontSize = 12.sp)
            }
        }
        Spacer(Modifier.height(20.dp))
        Text(t(R.string.google_intro), color = C.Ink, fontSize = 15.sp)
        Spacer(Modifier.height(14.dp))
        Panel {
            Text(t(R.string.privacy_title), color = C.Ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            Text(t(R.string.privacy_note), color = C.Muted, fontSize = 13.sp, modifier = Modifier.padding(top = 4.dp))
            Row(Modifier.padding(top = 8.dp).clickable { consent = !consent }, verticalAlignment = Alignment.CenterVertically) {
                Checkbox(checked = consent, onCheckedChange = { consent = it }, colors = CheckboxDefaults.colors(checkedColor = C.Sys, uncheckedColor = C.Muted))
                Text(t(R.string.privacy_accept), color = C.Ink, fontSize = 14.sp)
            }
        }
        BigButton(if (busy) t(R.string.activating) else t(R.string.google_sign_in), enabled = consent && !busy) {
            busy = true; err = null
            scope.launch {
                try {
                    val token = GoogleSignIn.idToken(ctx)
                    if (token != null) onDone(Repo.google(token, null, consent = true))
                } catch (e: Exception) { err = e.message } finally { busy = false }
            }
        }
        err?.let { Text(it, color = C.Alert, modifier = Modifier.padding(top = 8.dp)) }
    }
}

/* ---------------- Blood pressure tab ---------------- */

@Composable
fun HomeScreen(
    readings: List<Reading>, message: String?, me: Me?, onOpenCredit: () -> Unit, onAddKey: () -> Unit,
    onMeasure: () -> Unit, onVoice: () -> Unit, onTerms: () -> Unit
) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 18.dp, vertical = 12.dp)) {
        BrandHeader(onUpgrade = if (me != null && me.selfPays && !me.hasKey) onAddKey else null, premium = me != null && me.selfPays && me.hasKey)

        // a friend who pays for their own photos has no key yet
        // not linked to Google yet: with a new phone this diary could not be found again
        if (me != null && me.googleOn && !me.hasGoogle) WarnLine(t(R.string.google_banner), onOpenCredit)
        // one short warning line, only when the credit is low or used up
        val c = me?.credit
        // Anthropic said no at the last check: Scan is off, and this says why
        if (me != null && me.selfPays && me.hasKey && me.aiStatus == "no_credit") WarnLine(t(R.string.ai_no_credit), onOpenCredit)
        if (me != null && me.selfPays && me.hasKey && me.aiStatus == "invalid") WarnLine(t(R.string.ai_key_invalid), onOpenCredit)
        if (message != null) Panel { Text(message, color = C.Alert, fontSize = 14.sp) }

        // two ways to record a reading, side by side and of the same width: say it (free) or photograph it (AI credit)
        Row(verticalAlignment = Alignment.CenterVertically) {
            BigButton(t(R.string.record_short), color = C.Surface2, textColor = C.Ink, modifier = Modifier.weight(1f), icon = R.drawable.ic_mic, onClick = onVoice)
            Spacer(Modifier.width(10.dp))
            // the photo reading is the paid part: off until a key is saved, and off again when the credit is used up
            val c0 = me?.credit
            val scanOn = me == null || !me.selfPays || (me.hasKey && me.aiStatus == "ok")
            // the wand with sparkles says: artificial intelligence reads this photo
            BigButton(t(R.string.scan_short) + "*", enabled = scanOn, modifier = Modifier.weight(1f), icon = R.drawable.ic_camera, trailing = R.drawable.ic_ai_sparkle, onClick = onMeasure)
        }
        Text("* " + t(R.string.scan_cost_note), color = C.Muted, fontSize = 12.sp, modifier = Modifier.padding(start = 4.dp, end = 4.dp, top = 4.dp, bottom = 6.dp))

        LastPanel(readings.lastOrNull())
        WeekPanel(readings)
        SummaryPanel(readings.filter { !Z.date(it.takenAt).isBefore(Z.today().minusDays(6)) })

        Colophon(onTerms)
    }
}

@Composable
fun DeleteDialog(r: Reading, onDelete: () -> Unit, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(t(R.string.delete_q)) },
        text = { Text("${r.sis}/${r.dia}, ${Z.whenText(r.takenAt)}") },
        confirmButton = { TextButton(onClick = onDelete) { Text(t(R.string.delete), color = C.Alert) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text(t(R.string.cancel)) } },
        containerColor = C.Surface
    )
}

/** One reading: day, time with a sun or moon for the moment of the day, values, and Delete. */
@Composable
fun ReadingRow(r: Reading, onAskDelete: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 4.dp).clip(RoundedCornerShape(16.dp)).background(C.Surface).padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(Modifier.width(96.dp)) {
            Text(Z.relDay(Z.date(r.takenAt)), color = C.Ink, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(Z.time(r.takenAt), color = C.Muted, fontSize = 12.sp)
                Spacer(Modifier.width(5.dp))
                PeriodIcon(r.period, 13.dp)
            }
        }
        Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
            Text("${r.sis}", color = C.Sys, fontSize = 20.sp, fontWeight = FontWeight.Light)
            Text("/", color = C.Muted, fontSize = 20.sp)
            Text("${r.dia}", color = C.Dia, fontSize = 20.sp, fontWeight = FontWeight.Light)
            if (r.pul != null) Text("  ♥ ${r.pul}", color = C.Pul, fontSize = 13.sp)
            if (r.source == "voice") Text("  · " + t(R.string.source_voice).lowercase(), color = C.Muted, fontSize = 12.sp)
        }
        TextButton(onClick = onAskDelete) { Text(t(R.string.delete), color = C.Muted, fontSize = 12.sp) }
    }
}

/** Every reading kept (newest first), to check or delete one. */
@Composable
fun AllReadingsScreen(readings: List<Reading>, onDelete: (Reading) -> Unit, onDeleteAll: () -> Unit, onClose: () -> Unit) {
    var toDelete by remember { mutableStateOf<Reading?>(null) }
    var resetStep by remember { mutableIntStateOf(0) }   // 0 nothing, 1 first question, 2 last confirmation
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 18.dp, vertical = 12.dp)) {
        Header(t(R.string.all_readings), t(R.string.n_readings, readings.size), t(R.string.close), onClose, titleSize = 22)
        if (readings.isEmpty()) Panel { Text(t(R.string.report_empty), color = C.Muted, fontSize = 14.sp) }
        readings.reversed().forEach { r -> ReadingRow(r) { toDelete = r } }
        if (readings.isNotEmpty()) {
            Spacer(Modifier.height(18.dp))
            BigButton(t(R.string.reset_all), color = C.Surface2, textColor = C.Alert) { resetStep = 1 }
            Text(t(R.string.reset_all_note), color = C.Muted, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 4.dp))
        }
        Spacer(Modifier.height(24.dp))
    }
    toDelete?.let { r -> DeleteDialog(r, onDelete = { onDelete(r); toDelete = null }, onDismiss = { toDelete = null }) }
    // asked twice: the second time with the number of readings, and it cannot be undone
    if (resetStep > 0) AlertDialog(
        onDismissRequest = { resetStep = 0 },
        title = { Text(t(if (resetStep == 1) R.string.reset_q1 else R.string.reset_q2)) },
        text = { Text(if (resetStep == 1) t(R.string.reset_t1) else t(R.string.reset_t2, readings.size)) },
        confirmButton = {
            TextButton(onClick = { if (resetStep == 1) resetStep = 2 else { resetStep = 0; onDeleteAll() } }) {
                Text(t(if (resetStep == 1) R.string.reset_continue else R.string.reset_confirm), color = C.Alert)
            }
        },
        dismissButton = { TextButton(onClick = { resetStep = 0 }) { Text(t(R.string.cancel)) } },
        containerColor = C.Surface
    )
}

/**
 * The moment of the day as a small drawing instead of a word: sun (morning), sun on the horizon
 * (afternoon), moon (evening). [bg] is the colour behind it (used to cut the crescent and the horizon).
 */
@Composable
fun PeriodIcon(period: String, size: Dp = 14.dp, bg: Color = C.Surface) {
    Canvas(Modifier.size(size)) {
        val c = center
        val r = this.size.minDimension / 2f
        when (period) {
            "evening" -> {
                // crescent: a full disc with a second disc of the background colour over part of it
                drawCircle(C.Ink.copy(alpha = 0.85f), radius = r * 0.8f, center = c)
                drawCircle(bg, radius = r * 0.7f, center = Offset(c.x + r * 0.4f, c.y - r * 0.3f))
            }
            else -> {
                val afternoon = period == "afternoon"
                val sun = if (afternoon) Offset(c.x, c.y + r * 0.35f) else c
                for (k in 0 until 8) {
                    val a = Math.PI * k / 4
                    val dx = Math.cos(a).toFloat(); val dy = Math.sin(a).toFloat()
                    if (afternoon && dy > 0.1f) continue   // rays below the horizon are hidden
                    drawLine(C.Pul, Offset(sun.x + dx * r * 0.62f, sun.y + dy * r * 0.62f), Offset(sun.x + dx * r * 0.95f, sun.y + dy * r * 0.95f),
                        strokeWidth = r * 0.16f, cap = StrokeCap.Round)
                }
                drawCircle(C.Pul, radius = r * 0.42f, center = sun)
                if (afternoon) drawRect(bg, topLeft = Offset(0f, sun.y + r * 0.08f), size = Size(this.size.width, this.size.height))
                if (afternoon) drawLine(C.Muted, Offset(0f, sun.y + r * 0.08f), Offset(this.size.width, sun.y + r * 0.08f), strokeWidth = r * 0.12f)
            }
        }
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
                    Exponent("${last.sis}", "SYS", C.Sys, 64)
                    EcgLine()
                    Exponent("${last.dia}", "DIA", C.Dia, 64)
                }
                Exponent(last.pul?.toString() ?: "—", "PUL", C.Pul, 32)
            }
        }
    }
}

/** A big number with its name small at its top right, like an exponent: 127 ˢʸˢ. */
@Composable
fun Exponent(value: String, name: String, color: Color, size: Int) {
    Row(verticalAlignment = Alignment.Top) {
        Text(value, color = color, fontSize = size.sp, fontWeight = FontWeight.ExtraLight, lineHeight = (size + 2).sp)
        Text(
            name, color = color.copy(alpha = 0.8f), fontSize = maxOf(11f, size * 0.2f + 2).sp, fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(start = 3.dp, top = (size * 0.18f).dp)
        )
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
 * The app's logo, the same as the launcher icon: violet ECG trace on the app's navy,
 * here scrolling from right to left like on a heart monitor.
 */
@Composable
fun HintLogo(size: Dp = 30.dp) {
    val shift by rememberInfiniteTransition(label = "ecg").animateFloat(
        0f, 1f, infiniteRepeatable(tween(2200, easing = LinearEasing)), label = "shift"
    )
    // the same look as the launcher icon: diagonal violet-to-blue gradient, white heartbeat trace running through it
    Canvas(
        Modifier.size(size).clip(RoundedCornerShape(size * 0.28f))
            .background(Brush.linearGradient(listOf(Color(0xFFB07CF6), Color(0xFF7B6BEA), Color(0xFF2F86D9))))
    ) {
        // launcher trace from x 13 to 95 in a 108 box; both ends at the same height, so copies join seamlessly
        val pts = listOf(13f to 57.2f, 33.5f to 57.2f, 38.9f to 49.7f, 44.3f to 57.2f, 48.6f to 57.2f, 55.1f to 27f,
            62.1f to 84.2f, 68f to 57.2f, 74.5f to 57.2f, 79.9f to 51.8f, 85.3f to 57.2f, 95f to 57.2f)
        val period = 82f
        val k = this.size.width / period * 1.6f   // a little wider than the square: one beat and a half in view
        val trace = Path()
        for (copy in 0..1) pts.forEachIndexed { i, (x, y) ->
            val px = (x - 13f + period * copy - shift * period) * k
            // the tallest peak (30 units) reaches 36% of the height: the trace always stays inside the square
            val py = (y - 57.2f) * (this.size.height * 0.36f / 30f) + this.size.height / 2f
            if (copy == 0 && i == 0) trace.moveTo(px, py) else trace.lineTo(px, py)
        }
        drawPath(trace, Color.White, style = Stroke(width = size.toPx() * 0.06f, cap = StrokeCap.Round, join = StrokeJoin.Round))
    }
}

/** Home title: logo, the HINT wordmark and the full name in small capitals-like spacing. */
@Composable
fun BrandHeader(onUpgrade: (() -> Unit)? = null, premium: Boolean = false) {
    Row(Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 22.dp), verticalAlignment = Alignment.CenterVertically) {
        HintLogo(34.dp)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text("HINT 365", color = C.Ink, fontSize = 18.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 3.sp, lineHeight = 20.sp)
            Text(t(R.string.app_name), color = C.Muted, fontSize = 11.sp, letterSpacing = 0.5.sp, lineHeight = 13.sp)
        }
        // the version in use: Premium once the AI key is in; otherwise the way to the Upgrade stays in sight
        if (premium) {
            Text(
                "✦ PREMIUM", color = C.Sys, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 1.sp,
                modifier = Modifier.clip(RoundedCornerShape(50)).background(C.Sys.copy(alpha = 0.15f)).padding(horizontal = 10.dp, vertical = 4.dp)
            )
        } else if (onUpgrade != null) {
            Text(
                "✦ " + t(R.string.upgrade).uppercase(), color = C.Sys, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 1.sp,
                modifier = Modifier.clip(RoundedCornerShape(50)).border(1.dp, C.Sys.copy(alpha = 0.6f), RoundedCornerShape(50))
                    .clickable(onClick = onUpgrade).padding(horizontal = 10.dp, vertical = 4.dp)
            )
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
fun ReportScreen(readings: List<Reading>, onTerms: () -> Unit, onDash: () -> Unit) {
    val ctx = LocalContext.current
    var n by rememberSaveable { mutableIntStateOf(7) }
    val infos = listOf(7).associateWith { periodInfo(readings, it) }
    val per = infos.getValue(n)
    val st = stats(per.list)

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 18.dp, vertical = 12.dp)) {
        Header(t(R.string.report_title), t(R.string.report_sub))
        // the web dashboard, opened in the browser already signed in: bigger charts, and a link to send to the doctor
        GlowButton(t(R.string.my_dash) + "  ↗", onClick = onDash)
        Text(t(R.string.my_dash_sub), color = C.Muted, fontSize = 12.sp, modifier = Modifier.padding(start = 4.dp, end = 4.dp, bottom = 6.dp))

        Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(C.Surface).padding(4.dp)) {
            listOf(7).forEach { d ->
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
            // blood pressure only: the pulse is never drawn on the same chart
            BpChart(per.list, per.start, n, Modifier.fillMaxWidth().height(260.dp), pulse = false)
            Legend(pulse = false)
        }
        // boxes in pairs of the same height, dates written short so they fit on one line
        fun shortWhen(r: Reading) = "${Z.dmy(Z.date(r.takenAt))}, ${Z.time(r.takenAt)}"
        val puls = per.list.mapNotNull { it.pul }
        StatRow {
            StatBox(t(R.string.period_avg), "${st.sis}/${st.dia}", t(R.string.n_in_days, st.n, st.days), modifier = Modifier.weight(1f).fillMaxHeight())
            StatBox(t(R.string.avg_pulse), st.pul?.toString() ?: "—", t(R.string.per_minute), modifier = Modifier.weight(1f).fillMaxHeight())
        }
        StatRow {
            StatBox(t(R.string.avg_day), if (st.mN > 0) "${st.mS}/${st.mD}" else "—", t(R.string.n_readings, st.mN), modifier = Modifier.weight(1f).fillMaxHeight(), period = "morning")
            StatBox(t(R.string.avg_evening_label), if (st.eN > 0) "${st.eS}/${st.eD}" else "—", t(R.string.n_readings, st.eN), modifier = Modifier.weight(1f).fillMaxHeight(), period = "evening")
        }
        StatRow {
            StatBox(t(R.string.peak_sys), st.maxS?.let { "${it.sis}/${it.dia}" } ?: "—", st.maxS?.let { shortWhen(it) }, C.Sys, Modifier.weight(1f).fillMaxHeight())
            StatBox(t(R.string.max_dia), st.maxD?.let { "${it.sis}/${it.dia}" } ?: "—", st.maxD?.let { shortWhen(it) }, C.Dia, Modifier.weight(1f).fillMaxHeight())
        }
        StatRow {
            StatBox(t(R.string.lowest), st.minS?.let { "${it.sis}/${it.dia}" } ?: "—", st.minS?.let { shortWhen(it) }, modifier = Modifier.weight(1f).fillMaxHeight())
            StatBox(t(R.string.pulse_range), if (puls.isEmpty()) "—" else "${puls.min()}–${puls.max()}", t(R.string.per_minute), C.Pul, Modifier.weight(1f).fillMaxHeight())
        }

        Spacer(Modifier.height(8.dp))
        if (!per.ok) Text(t(R.string.report_not_yet, n, per.missing), color = C.Muted, fontSize = 14.sp)
        BigButton(t(R.string.send_pdf), enabled = per.ok) {
            try { shareFile(ctx, buildPdf(ctx, readings, n), "application/pdf") } catch (e: Exception) { toast(ctx, t(R.string.file_failed, e.message ?: "")) }
        }
        BigButton(t(R.string.send_excel), color = C.Surface2, textColor = C.Ink, enabled = per.ok) {
            try { shareFile(ctx, buildCsv(ctx, readings, n), "text/csv") } catch (e: Exception) { toast(ctx, t(R.string.file_failed, e.message ?: "")) }
        }
        Colophon(onTerms)
    }
}


/* ---------------- Credit tab ---------------- */

@Composable
fun CreditScreen(
    me: Me?, readingsCount: Int, onRecharge: () -> Unit, onCorrect: () -> Unit,
    onKey: () -> Unit, onDeleteKey: () -> Unit, onCheckAi: () -> Unit, checkingAi: Boolean,
    onLinkGoogle: () -> Unit, onSignOut: () -> Unit, onDeleteAccount: () -> Unit, onManageReadings: () -> Unit,
    onTerms: () -> Unit, onAppMinVersion: (Int) -> Unit = {}, onSubscriptionOn: (Boolean) -> Unit = {}
) {
    var signOutAsk by remember { mutableStateOf(false) }
    var appOffAsk by remember { mutableStateOf<Int?>(null) }
    var subAsk by remember { mutableStateOf<Boolean?>(null) }   // owner: subscription on (true) / off (false) waiting for confirmation   // administrator: the minimum version waiting for confirmation
    var deleteStep by remember { mutableIntStateOf(0) }   // delete my account: 0 nothing, 1 question, 2 last confirmation
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 18.dp, vertical = 12.dp)) {
        Header(t(R.string.tab_credit))
        if (me == null) {
            Panel { Text("…", color = C.Muted) }
            return@Column
        }

        // Credits: the money left for the AI readings, and adding to it
        SectionTitle(t(R.string.section_credits))
        val c = me.credit
        val noKey = me.selfPays && !me.hasKey
        // Anthropic lets no app read the balance: shown instead is what Anthropic answered (credit there or not),
        // what was spent with HINT (exact, from each reading) and the cost of one photo
        Panel {
            // the money spent, as far as HINT 365 can count it; the balance itself only Anthropic knows
            Text(t(R.string.credit_estimated), color = C.Ink, fontSize = 17.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(bottom = 6.dp))
            val cost = c?.avgCost ?: 0.006
            CreditRow(t(R.string.credit_spent), if (noKey) "—" else usd(c?.spentAll ?: 0.0))
            CreditRow(t(R.string.credit_per_photo), "≈ " + usdFine(cost))
            CreditRow(t(R.string.credit_photos_per_usd), if (cost > 0) "≈ " + (1.0 / cost).toInt() else "—")
            // said only when Anthropic answered no: then Scan is off until the credit is back
            if (!noKey && me.aiStatus != "ok")
                Text(t(if (me.aiStatus == "no_credit") R.string.credit_out_note else R.string.credit_key_note), color = C.Alert, fontSize = 13.sp, modifier = Modifier.padding(top = 10.dp))
            if (noKey) Text(t(R.string.credit_needs_key), color = C.Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 10.dp))
            else Text(t(R.string.credit_see_anthropic), color = C.Sys, fontSize = 14.sp, fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(top = 12.dp).clickable(onClick = onRecharge))
        }
        BigButton(t(R.string.recharge), onClick = onRecharge)

        // Token: the Anthropic key that pays the readings
        SectionTitle(t(R.string.section_token))
        // Standard until the AI key is in, then Premium
        Text(t(if (me.selfPays && me.hasKey) R.string.version_premium else R.string.version_standard), color = if (me.hasKey) C.Sys else C.Muted,
            fontSize = 14.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(start = 4.dp, bottom = 4.dp))
        if (me.selfPays) {
            if (!me.hasKey) {
                Panel { Text(t(R.string.key_missing), color = C.Ink, fontSize = 15.sp) }
                BigButton("✦ " + t(R.string.upgrade), onClick = onKey)
            } else {
                Panel {
                    Text(t(R.string.token_own_set), color = C.Ink, fontSize = 14.sp)
                    // what Anthropic answered at the last check, and when
                    val st = when (me.aiStatus) { "ok" -> R.string.ai_state_ok; "no_credit" -> R.string.ai_state_no_credit; "invalid" -> R.string.ai_state_invalid; else -> R.string.ai_state_ok }
                    Text(t(st) + (me.aiCheckedAt?.let { " · " + Z.whenText(it) } ?: ""), color = if (me.aiStatus == "ok") C.Muted else C.Alert, fontSize = 13.sp, modifier = Modifier.padding(top = 6.dp))
                }
                BigButton(t(R.string.ai_check_now), color = C.Surface2, textColor = C.Ink, enabled = !checkingAi, onClick = onCheckAi)
                BigButton(t(R.string.replace_key), color = C.Surface2, textColor = C.Ink, onClick = onKey)
                TextButton(onClick = onDeleteKey, modifier = Modifier.fillMaxWidth()) {
                    Text(t(R.string.delete_key), color = C.Muted, fontSize = 13.sp, textAlign = TextAlign.Center)
                }
            }
        } else {
            Panel { Text(t(if (me.isAdmin) R.string.token_owner_admin else R.string.token_owner_member), color = C.Ink, fontSize = 14.sp) }
        }

        // Readings database: every reading, to delete a wrong one or all of them
        SectionTitle(t(R.string.section_db))
        Panel { Text(t(R.string.db_count, readingsCount), color = C.Ink, fontSize = 14.sp) }
        BigButton(t(R.string.manage_readings), color = C.Surface2, textColor = C.Ink, onClick = onManageReadings)

        // Identity: the Google account, who can join, and deleting it all
        SectionTitle(t(R.string.section_identity))
        if (me.hasGoogle) {
            Panel {
                // the email is kept only on this phone; the server keeps just an encrypted fingerprint of the Google account
                val localEmail = LocalContext.current.getSharedPreferences("battito", Context.MODE_PRIVATE).getString("googleEmail", null)
                Text(localEmail ?: "Google", color = C.Ink, fontSize = 15.sp)
                Text(t(R.string.account_linked), color = C.Muted, fontSize = 13.sp)
            }
        } else if (me.googleOn) {
            Panel { Text(t(R.string.account_not_linked), color = C.Ink, fontSize = 14.sp) }
            BigButton(t(R.string.google_link), color = C.Surface2, textColor = C.Ink, onClick = onLinkGoogle)
        }
        // the download link, for anyone who wants the app: with Sign in with Google they set it up on their own
        val shareCtx = LocalContext.current
        BigButton(t(R.string.share_app), color = C.Surface2, textColor = C.Ink) { shareApp(shareCtx) }
        // leave this phone: only with Google linked, otherwise there would be no way back in
        if (me.hasGoogle) {
            TextButton(onClick = { signOutAsk = true }, modifier = Modifier.fillMaxWidth()) {
                Text(t(R.string.sign_out), color = C.Muted, fontSize = 13.sp)
            }
        }
        if (!me.isAdmin) {
            TextButton(onClick = { deleteStep = 1 }, modifier = Modifier.fillMaxWidth()) {
                Text(t(R.string.account_delete), color = C.Alert, fontSize = 13.sp)
            }
        }

        // Subscription: the owner switches it on for everyone else; a subscriber sees until when it is paid
        if (me.isAdmin) {
            SectionTitle(t(R.string.section_subscription))
            Panel {
                Text(t(if (me.subscriptionOn) R.string.sub_admin_on else R.string.sub_admin_off), color = C.Ink, fontSize = 14.sp)
                Text(t(R.string.sub_admin_how), color = C.Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp))
            }
            BigButton(t(if (me.subscriptionOn) R.string.sub_admin_turn_off else R.string.sub_admin_turn_on), color = C.Surface2, textColor = C.Ink) {
                subAsk = !me.subscriptionOn
            }
        } else if (me.sub.required && me.sub.active) {
            SectionTitle(t(R.string.section_subscription))
            Panel {
                Text(t(R.string.sub_active_until, me.sub.until?.let { Z.long(Z.date(it)) } ?: "—"), color = C.Ink, fontSize = 14.sp)
                Text(t(R.string.sub_cancel_note), color = C.Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp))
            }
            val subCtx = LocalContext.current
            BigButton(t(R.string.sub_manage), color = C.Surface2, textColor = C.Ink) {
                try { subCtx.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(Billing.MANAGE_URL))) } catch (_: Exception) { }
            }
        }

        // App versions (administrator): switch off the apps installed with older versions, or let them all work again
        if (me.isAdmin) {
            SectionTitle(t(R.string.section_versions))
            val mine = BuildConfig.VERSION_CODE
            Panel {
                Text(t(R.string.versions_state, mine, if (me.appMinVersion > 0) me.appMinVersion.toString() else "—"), color = C.Ink, fontSize = 14.sp)
                Text(t(R.string.versions_how), color = C.Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp))
            }
            if (me.appMinVersion < mine)
                BigButton(t(R.string.versions_off_older), color = C.Surface2, textColor = C.Ink) { appOffAsk = mine }
            if (me.appMinVersion > 0)
                TextButton(onClick = { appOffAsk = 0 }, modifier = Modifier.fillMaxWidth()) {
                    Text(t(R.string.versions_all_on), color = C.Muted, fontSize = 13.sp)
                }
        }
        Colophon(onTerms)
    }
    subAsk?.let { on ->
        AlertDialog(
            onDismissRequest = { subAsk = null },
            title = { Text(t(if (on) R.string.sub_admin_turn_on else R.string.sub_admin_turn_off)) },
            text = { Text(t(if (on) R.string.sub_admin_on_q else R.string.sub_admin_off_q)) },
            confirmButton = { TextButton(onClick = { subAsk = null; onSubscriptionOn(on) }) { Text(t(R.string.versions_confirm), color = C.Sys) } },
            dismissButton = { TextButton(onClick = { subAsk = null }) { Text(t(R.string.cancel)) } },
            containerColor = C.Surface
        )
    }
    appOffAsk?.let { v ->
        AlertDialog(
            onDismissRequest = { appOffAsk = null },
            title = { Text(t(if (v > 0) R.string.versions_off_older else R.string.versions_all_on)) },
            text = { Text(if (v > 0) t(R.string.versions_off_q, v) else t(R.string.versions_on_q)) },
            confirmButton = { TextButton(onClick = { appOffAsk = null; onAppMinVersion(v) }) { Text(t(R.string.versions_confirm), color = C.Sys) } },
            dismissButton = { TextButton(onClick = { appOffAsk = null }) { Text(t(R.string.cancel)) } },
            containerColor = C.Surface
        )
    }
    if (signOutAsk) AlertDialog(
        onDismissRequest = { signOutAsk = false },
        title = { Text(t(R.string.sign_out_q)) },
        text = { Text(t(R.string.sign_out_t, LocalContext.current.getSharedPreferences("battito", Context.MODE_PRIVATE).getString("googleEmail", null) ?: "Google")) },
        confirmButton = { TextButton(onClick = { signOutAsk = false; onSignOut() }) { Text(t(R.string.sign_out), color = C.Sys) } },
        dismissButton = { TextButton(onClick = { signOutAsk = false }) { Text(t(R.string.cancel)) } },
        containerColor = C.Surface
    )
    if (deleteStep > 0) AlertDialog(
        onDismissRequest = { deleteStep = 0 },
        title = { Text(t(if (deleteStep == 1) R.string.account_delete_q1 else R.string.reset_q2)) },
        text = { Text(t(if (deleteStep == 1) R.string.account_delete_t1 else R.string.account_delete_t2)) },
        confirmButton = {
            TextButton(onClick = { if (deleteStep == 1) deleteStep = 2 else { deleteStep = 0; onDeleteAccount() } }) {
                Text(t(if (deleteStep == 1) R.string.reset_continue else R.string.account_delete_confirm), color = C.Alert)
            }
        },
        dismissButton = { TextButton(onClick = { deleteStep = 0 }) { Text(t(R.string.cancel)) } },
        containerColor = C.Surface
    )
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
