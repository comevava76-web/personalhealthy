package ch.personalhealthy.app

import android.content.Context
import android.content.res.Resources
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.exifinterface.media.ExifInterface
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.MessageDigest
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.time.format.TextStyle
import java.time.temporal.ChronoUnit
import java.util.Locale
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/* ---------------- Texts in the phone's language ---------------- */

/** The app speaks Italian, German, French or English: any other phone language gets English (texts fall back to
 *  values/ by themselves; this keeps dates, weekdays and the server's answers in the same language). English dates
 *  are written the British way (day/month, 24 h). */
val APP_LANGS = setOf("it", "de", "fr", "en")
fun appLocale(): Locale = Locale.getDefault().let { if (it.language in APP_LANGS) it else Locale.UK }

object Txt {
    @Volatile var res: Resources? = null
    fun init(ctx: Context) { res = ctx.resources }
}

/** The server's address. It is not fixed in the app: at every opening and every return the app asks the server where
 *  it is now (/v1/where) and follows it; if the old address no longer answers, it tries the "next" one the server gave
 *  earlier (or the one built in). A new address is used only after it answers as HINT 365 over HTTPS. Source of the
 *  addresses: config/server.json in the repository; steps in docs/operations/domain.md. */
object Server {
    @Volatile var base: String = BuildConfig.API_URL.trimEnd('/')
        private set
    @Volatile private var next: String = BuildConfig.API_NEXT.trimEnd('/')
    private var prefs: android.content.SharedPreferences? = null

    fun init(ctx: Context) {
        if (prefs != null) return
        val p = ctx.applicationContext.getSharedPreferences("server", Context.MODE_PRIVATE)
        prefs = p
        p.getString("api", null)?.takeIf { ok(it) }?.let { base = it }
        p.getString("next", null)?.takeIf { ok(it) }?.let { next = it }
    }

    private fun ok(u: String) = try {
        val x = URL(u)
        x.protocol == "https" && x.host.isNotEmpty() && x.query == null && (x.path.isEmpty() || x.path == "/") && x.userInfo == null
    } catch (_: Exception) { false }

    /** {service, api, next} from [at], or null if it does not answer (offline, gone, not HINT 365). */
    private fun where(at: String): JSONObject? = try {
        val c = URL("$at/v1/where").openConnection() as HttpURLConnection
        c.connectTimeout = 8000; c.readTimeout = 8000; c.instanceFollowRedirects = false
        try {
            if (c.responseCode != 200) null
            else JSONObject(c.inputStream.bufferedReader().use { it.readText() }).takeIf { it.optString("service") == "hint365" }
        } finally { c.disconnect() }
    } catch (_: Exception) { null }

    /** A new address is taken only if it answers itself as the current HINT 365 server. */
    private fun moveTo(cand: String): Boolean {
        val there = where(cand) ?: return false
        if (there.optString("api").trimEnd('/') != cand) return false
        base = cand
        val n = there.optString("next").trimEnd('/')
        next = if (ok(n)) n else ""
        prefs?.edit()?.putString("api", base)?.putString("next", next)?.apply()
        return true
    }

    /** Asked when the app opens and every time it comes back. Never fails: offline, nothing changes. */
    suspend fun refresh() = withContext(Dispatchers.IO) {
        val here = where(base)
        if (here != null) {
            val n = here.optString("next").trimEnd('/')
            if (ok(n) && n != next) { next = n; prefs?.edit()?.putString("next", n)?.apply() }
            val api = here.optString("api").trimEnd('/')
            if (ok(api) && api != base) moveTo(api)
        } else {
            // the old address does not answer: the address the server announced, then the one built into the app
            for (cand in listOf(next, BuildConfig.API_URL.trimEnd('/'), BuildConfig.API_NEXT.trimEnd('/')).distinct())
                if (ok(cand) && cand != base && moveTo(cand)) break
        }
        Unit
    }
}

/** Where anyone can download the latest app (the server publishes it; the repository is private). */
val DOWNLOAD_URL: String get() = Server.base + "/download"

/** Opens the phone's share sheet with the app's download link, to send to a friend. */
/** The notice on the web, the same text the app shows before first use. */
val TERMS_URL: String get() = Server.base + "/terms"
/** Version of the notice: must match the server's; a new version asks everyone to accept again. */
const val DISCLAIMER_VERSION = "22"

fun shareApp(ctx: Context) {
    val send = android.content.Intent(android.content.Intent.ACTION_SEND).setType("text/plain")
        .putExtra(android.content.Intent.EXTRA_TEXT, englishText(ctx, R.string.share_app_text, DOWNLOAD_URL))
    ctx.startActivity(android.content.Intent.createChooser(send, t(R.string.share_app)))
}

/** The invitation always goes out in English, whatever the language of the phone. */
fun englishText(ctx: Context, id: Int, vararg args: Any): String {
    val conf = android.content.res.Configuration(ctx.resources.configuration).apply { setLocale(java.util.Locale.ENGLISH) }
    return ctx.createConfigurationContext(conf).resources.getString(id, *args)
}

/**
 * Translated text (English, Italian, German or French, following the phone). Formatted only when there are
 * arguments: a plain text may contain a "%" of its own, such as "Neutrophils (%)" (error log 2026-09-30, Core.kt:72).
 */
fun t(id: Int, vararg args: Any): String = Txt.res?.let { if (args.isEmpty()) it.getString(id) else it.getString(id, *args) } ?: ""

/** The moment of the day in the tables, short to save space: before 12:00 AM, after PM. */
fun ampm(p: String): String = if (p == "morning") "AM" else "PM"

fun periodLabel(p: String): String = when (p) {
    "morning" -> t(R.string.period_morning)
    "afternoon" -> t(R.string.period_afternoon)
    "evening" -> t(R.string.period_evening)
    else -> p
}

/* ---------------- Models ---------------- */

/** [source]: "photo" (read from the monitor's display) or "voice" (said aloud). */
data class Reading(val id: String, val takenAt: Long, val period: String, val sis: Int, val dia: Int, val pul: Int?, val source: String = "photo")

fun sourceLabel(s: String): String = if (s == "voice") t(R.string.source_voice) else t(R.string.source_photo)

/**
 * What was understood from values said aloud. [values] is null when they cannot be saved, and [problem]
 * says why. [unusual] lists values that are possible but strange, shown before saving so a misheard
 * number is noticed.
 */
class Spoken(val values: Triple<Int, Int, Int?>?, val problem: String?, val unusual: List<String> = emptyList())

/**
 * Values said aloud, in this order: systolic, diastolic, pulse (for example "127, 80, 70"). All three are needed.
 * Tries each transcription the phone offers and takes the first that passes every check;
 * otherwise explains what is wrong with the first one that had numbers.
 * Never saved: a missing number, more than three, diastolic equal to or higher than systolic,
 * or values outside what a monitor can show.
 */
fun parseSpoken(texts: List<String>): Spoken {
    var firstProblem: String? = null
    for (text in texts) {
        val n = Regex("\\d+").findAll(text).map { it.value.toIntOrNull() ?: Int.MAX_VALUE }.toList()
        if (n.isEmpty()) continue
        val sis = n[0]; val dia = n.getOrNull(1) ?: 0; val pul = n.getOrNull(2)
        val problem = when {
            n.size < 3 -> t(R.string.voice_missing, n.joinToString(", "))
            n.size > 3 -> t(R.string.voice_too_many, n.joinToString(", "))
            sis !in 50..260 -> t(R.string.voice_out_of_range, t(R.string.legend_sys), sis)
            dia !in 30..160 -> t(R.string.voice_out_of_range, t(R.string.legend_dia), dia)
            dia >= sis -> t(R.string.voice_dia_high, dia, sis)
            pul != null && pul !in 30..220 -> t(R.string.voice_out_of_range, t(R.string.label_pul), pul)
            else -> null
        }
        if (problem != null) { if (firstProblem == null) firstProblem = problem; continue }
        val unusual = buildList {
            if (sis - dia < 20) add(t(R.string.voice_unusual_gap, sis - dia))
            if (sis >= 180 || sis < 90) add(t(R.string.voice_unusual_value, t(R.string.legend_sys), sis))
            if (dia >= 110 || dia < 50) add(t(R.string.voice_unusual_value, t(R.string.legend_dia), dia))
            if (pul != null && (pul < 40 || pul > 130)) add(t(R.string.voice_unusual_value, t(R.string.label_pul), pul))
        }
        return Spoken(Triple(sis, dia, pul), null, unusual)
    }
    return Spoken(null, firstProblem ?: t(R.string.voice_not_understood))
}

/** [hasGoogle]: the account is linked to a Google account ([email]), so it can be found again on a new phone. */
/** [required]: this account must pay; [active]: paid until [until]. Expired = required, not active, [until] set.
 *  [scan]: the photo Scan, the only thing the subscription unlocks: "on", "trial" (free until [trialUntil]) or "locked". */
data class Sub(val required: Boolean = false, val active: Boolean = true, val until: Long? = null, val state: String = "",
               val scan: String = "on", val trialUntil: Long? = null, val trialStarted: Boolean = false,
               /** about how many Scans are left in the subscriber's yearly allowance (null: owner, or not subscribed) */
               val scansLeft: Int? = null,
               /** Scans made in the last 12 months (null: the owner) */
               val scansUsed: Int? = null) {
    val blocked: Boolean get() = required && !active
}

data class Me(
    val isAdmin: Boolean, val billingMode: String,
    val hasGoogle: Boolean = false, val email: String? = null, val googleOn: Boolean = false,
    val disclaimerOk: Boolean = true,
    /** Administrator only: apps below this version are switched off (0 = none). */
    val appMinVersion: Int = 0,
    /** The yearly subscription; [subscriptionOn] (owner only) = everyone else must have one. */
    val sub: Sub = Sub(), val subscriptionOn: Boolean = false,
    /** The owner's account on a phone not on record: the owner's secret code makes it the owner's phone. */
    val ownerClaim: Boolean = false
)

/** Amber of the short warning lines (Google not linked, no screen lock). */
const val WARN_COLOR = 0xFFFFB35C

/* ---------------- Dates and times (Lugano time) ---------------- */

object Z {
    val zone: ZoneId = ZoneId.of("Europe/Zurich")
    private fun loc(): Locale = appLocale()

    fun date(ts: Long): LocalDate = Instant.ofEpochMilli(ts).atZone(zone).toLocalDate()
    fun today(): LocalDate = LocalDate.now(zone)
    fun time(ts: Long): String = DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT).withLocale(loc()).withZone(zone).format(Instant.ofEpochMilli(ts))
    fun dmy(d: LocalDate): String = DateTimeFormatter.ofLocalizedDate(FormatStyle.SHORT).withLocale(loc()).format(d)
    fun long(d: LocalDate): String = DateTimeFormatter.ofLocalizedDate(FormatStyle.LONG).withLocale(loc()).format(d)
    fun short(d: LocalDate): String = DateTimeFormatter.ofPattern("d MMM", loc()).format(d)
    fun weekday(d: LocalDate): String = d.dayOfWeek.getDisplayName(TextStyle.SHORT, loc()).trimEnd('.')

    fun relDay(d: LocalDate): String {
        val t0 = today()
        return when (d) {
            t0 -> t(R.string.today)
            t0.minusDays(1) -> t(R.string.yesterday)
            else -> d.dayOfWeek.getDisplayName(TextStyle.FULL, loc()).replaceFirstChar { c -> c.uppercase() } + " " + short(d)
        }
    }

    fun whenText(ts: Long): String = t(R.string.when_fmt, relDay(date(ts)), time(ts))
}

fun cap(s: String) = s.replaceFirstChar { it.uppercase() }

/* ---------------- Periods and statistics ---------------- */

data class PeriodInfo(val ok: Boolean, val missing: Int, val start: LocalDate, val end: LocalDate, val list: List<Reading>)

fun periodInfo(all: List<Reading>, n: Int): PeriodInfo {
    if (all.isEmpty()) {
        val today = Z.today()
        return PeriodInfo(false, n, today.minusDays(n - 1L), today, emptyList())
    }
    val first = Z.date(all.first().takenAt)
    val last = Z.date(all.last().takenAt)
    val start = last.minusDays(n - 1L)
    val ok = !first.isAfter(start)
    val missing = if (ok) 0 else ChronoUnit.DAYS.between(start, first).toInt()
    val list = all.filter { val d = Z.date(it.takenAt); !d.isBefore(start) && !d.isAfter(last) }
    return PeriodInfo(ok, missing, start, last, list)
}

data class Stats(
    val n: Int, val days: Int, val sis: Int?, val dia: Int?, val pul: Int?,
    val mS: Int?, val mD: Int?, val mN: Int, val eS: Int?, val eD: Int?, val eN: Int,
    val maxS: Reading?, val maxD: Reading?, val minS: Reading?
)

private fun avg(l: List<Int>): Int? = if (l.isEmpty()) null else l.average().roundToInt()

fun stats(list: List<Reading>): Stats {
    val m = list.filter { it.period == "morning" }
    val e = list.filter { it.period == "evening" }
    return Stats(
        n = list.size,
        days = list.map { Z.date(it.takenAt) }.toSet().size,
        sis = avg(list.map { it.sis }), dia = avg(list.map { it.dia }),
        pul = avg(list.mapNotNull { it.pul }),
        mS = avg(m.map { it.sis }), mD = avg(m.map { it.dia }), mN = m.size,
        eS = avg(e.map { it.sis }), eD = avg(e.map { it.dia }), eN = e.size,
        maxS = list.maxByOrNull { it.sis }, maxD = list.maxByOrNull { it.dia }, minS = list.minByOrNull { it.sis }
    )
}

/* ---------------- The phone's anonymous key ---------------- */

object Keys {
    private const val ALIAS = "battito_device_key" // keep: renaming it would lose the key already on the phone

    private fun ensure(): KeyPair {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        if (ks.containsAlias(ALIAS)) {
            val e = ks.getEntry(ALIAS, null) as KeyStore.PrivateKeyEntry
            return KeyPair(e.certificate.publicKey, e.privateKey)
        }
        val g = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore")
        g.initialize(
            KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_SIGN)
                .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
                .setDigests(KeyProperties.DIGEST_SHA256)
                .build()
        )
        return g.generateKeyPair()
    }

    fun publicKeyB64(): String = Base64.encodeToString(ensure().public.encoded, Base64.NO_WRAP)

    fun sign(data: ByteArray): String {
        val s = Signature.getInstance("SHA256withECDSA")
        s.initSign(ensure().private)
        s.update(data)
        return Base64.encodeToString(s.sign(), Base64.NO_WRAP)
    }
}

/* ---------------- Server connection ---------------- */

class ApiException(val code: String) : Exception(errorText(code))

/**
 * Errors met in the app go to the server's grouped error log (worker/src/errors.ts), so bugs users run into are seen
 * and fixed. Short on purpose: at most 20 reports per session, no reading value (the server also removes digits),
 * only the anonymous account code. Errors answered by the server are already logged there and are not sent again.
 */
object ErrorReport {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    @Volatile var personId: String? = null
    private val sent = java.util.concurrent.atomic.AtomicInteger(0)

    fun report(place: String, e: Throwable) {
        if (e is ApiException) return
        send(e.javaClass.simpleName, place, e.message ?: "")
    }

    fun send(code: String, place: String, message: String) {
        val pid = personId ?: return
        if (sent.incrementAndGet() > 20) return
        scope.launch {
            try { Api.call("POST", "/v1/log", JSONObject().put("code", code).put("place", place.take(80)).put("message", message.take(300)), pid) }
            catch (_: Exception) { }
        }
    }

    /** A crash, kept until the app opens again: its type, and the first line of the app's own code it went through. */
    fun crashRecord(e: Throwable): String {
        val frame = e.stackTrace.firstOrNull { it.className.startsWith("ch.personalhealthy") }
        val where = frame?.let { "${it.fileName}:${it.lineNumber}" } ?: "unknown"
        return listOf(e.javaClass.simpleName, where, (e.message ?: "").take(200)).joinToString("\u0001")
    }
}

/** This version of the app switched off remotely: the app shows only the page to install the latest one. */
object AppGate {
    var disabled by mutableStateOf(false)
    /** The server said the subscription has run out (the app then shows the invitation to renew). */
    var subExpired by mutableStateOf(false)
}

fun errorText(code: String): String = when (code) {
    "bad_clock" -> t(R.string.err_bad_clock)
    "app_disabled" -> t(R.string.app_off_title)
    "sub_expired" -> t(R.string.sub_title_expired)
    "sub_unavailable" -> t(R.string.err_sub_unavailable)
    "sub_invalid" -> t(R.string.err_sub_invalid)
    "sub_other_account" -> t(R.string.err_sub_other_account)
    "family_code" -> t(R.string.err_family_code)
    "invite_used" -> t(R.string.err_invite_used)
    "invite_expired" -> t(R.string.err_invite_expired)
    "friend_no_key" -> t(R.string.err_friend_no_key)
    "friend_no_credit" -> t(R.string.err_friend_no_credit)
    "friend_key_invalid" -> t(R.string.err_friend_key_invalid)
    "key_test_failed" -> t(R.string.err_key_test_failed)
    "unauthorized", "bad_key" -> t(R.string.err_unauthorized)
    "photo_time" -> t(R.string.err_photo_time)
    "no_photo" -> t(R.string.err_no_photo)
    "read_failed" -> t(R.string.err_read_failed)
    "anthropic_no_credit" -> t(R.string.err_anthropic_no_credit)
    "not_found" -> t(R.string.err_not_found)
    "already_saved" -> t(R.string.err_already_saved)
    "scan_expired" -> t(R.string.err_scan_expired)
    "scan_invalid" -> t(R.string.err_scan_invalid)
    "voice_invalid" -> t(R.string.err_voice_invalid)
    "voice_time" -> t(R.string.err_voice_time)
    "google_off" -> t(R.string.err_google_off)
    "google_invalid", "google_failed" -> t(R.string.err_google_failed)
    "google_no_account" -> t(R.string.err_google_no_account)
    "google_other" -> t(R.string.err_google_other)
    "phone_in_use" -> t(R.string.err_phone_in_use)
    "consent_required" -> t(R.string.err_consent_required)
    "admin_delete" -> t(R.string.err_admin_delete)
    "admin_only" -> t(R.string.err_admin_only)
    "bad_amount" -> t(R.string.err_bad_amount)
    "server" -> t(R.string.err_server)
    "network" -> t(R.string.err_network)
    "photo_unreadable" -> t(R.string.err_photo_unreadable)
    else -> t(R.string.err_generic)
}

object Api {
    private val base: String get() = Server.base
    /** This phone's Android id (same app, same phone): the server keeps only an HMAC of it, to count the Scan trial
     *  once per phone. Set at start-up. */
    var device: String? = null

    private fun sha256Hex(b: ByteArray): String =
        MessageDigest.getInstance("SHA-256").digest(b).joinToString("") { "%02x".format(it) }

    /** One call to the server. If the server cannot be reached (for example its address changed while the app stayed
     *  open), the app asks where it is now and, if it moved, tries once more at the new address. */
    suspend fun call(method: String, path: String, body: JSONObject?, personId: String?): JSONObject =
        try { once(method, path, body, personId) } catch (e: ApiException) {
            if (e.code != "network") throw e
            val before = Server.base
            Server.refresh()
            if (Server.base == before) throw e
            once(method, path, body, personId)
        }

    private suspend fun once(method: String, path: String, body: JSONObject?, personId: String?): JSONObject =
        withContext(Dispatchers.IO) {
            val bytes = body?.toString()?.toByteArray(Charsets.UTF_8) ?: ByteArray(0)
            val ts = System.currentTimeMillis().toString()
            val sig = Keys.sign("$method\n$path\n$ts\n${sha256Hex(bytes)}".toByteArray(Charsets.UTF_8))
            val c = try {
                URL(base + path).openConnection() as HttpURLConnection
            } catch (e: Exception) {
                throw ApiException("network")
            }
            try {
                c.requestMethod = method
                c.connectTimeout = 15000
                c.readTimeout = 120000
                c.setRequestProperty("X-Ts", ts)
                c.setRequestProperty("X-Sig", sig)
                c.setRequestProperty("X-Lang", appLocale().language)
                c.setRequestProperty("X-App-Version", BuildConfig.VERSION_CODE.toString())
                if (personId != null) c.setRequestProperty("X-Person", personId)
                device?.let { c.setRequestProperty("X-Device", it) }
                if (body != null) {
                    c.doOutput = true
                    c.setRequestProperty("Content-Type", "application/json")
                    c.outputStream.use { it.write(bytes) }
                }
                val code = c.responseCode
                val stream = if (code in 200..299) c.inputStream else c.errorStream
                val txt = stream?.bufferedReader()?.use { it.readText() } ?: ""
                val j = try { JSONObject(txt) } catch (e: Exception) { JSONObject() }
                if (code !in 200..299) {
                    val err = j.optString("code", if (code >= 500) "server" else "generic")
                    if (err == "app_disabled") AppGate.disabled = true
                    if (err == "sub_expired") AppGate.subExpired = true
                    throw ApiException(err)
                }
                j
            } catch (e: ApiException) {
                throw e
            } catch (e: Exception) {
                throw ApiException("network")
            } finally {
                c.disconnect()
            }
        }
}

object Repo {
    suspend fun register(code: String): String {
        // the family code or an invite code: the server tells them apart
        val body = JSONObject().put("code", code).put("publicKey", Keys.publicKeyB64())
        return Api.call("POST", "/v1/register", body, null).getString("personId")
    }

    /**
     * Sign in with Google: finds this person's account (and moves it to this phone), links Google to this phone's
     * account, or creates a new one (which pays its own readings). [code] is kept for the server and is not used.
     * [consent]: the privacy note was accepted. Returns the person id.
     */
    suspend fun google(idToken: String, code: String?, consent: Boolean): String {
        val body = JSONObject().put("idToken", idToken).put("publicKey", Keys.publicKeyB64()).put("consent", consent)
        if (!code.isNullOrBlank()) body.put("code", code.trim())
        return Api.call("POST", "/v1/auth/google", body, null).getString("personId")
    }

    /** Deletes this person's account and every data of theirs on the server. */
    /** The notice accepted on this phone: the server records it with the account, the phone and the exact text shown. */
    suspend fun acceptNotice(pid: String, version: String, lang: String, text: String, appVersion: String, phone: String) {
        val sha = java.security.MessageDigest.getInstance("SHA-256").digest(text.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
        Api.call("POST", "/v1/accept", JSONObject().put("doc", "disclaimer").put("version", version).put("lang", lang)
            .put("healthConsent", true).put("textSha256", sha).put("appVersion", appVersion).put("phone", phone), pid)
    }

    /** My Dash: the address of the web dashboard with a one-time code (60 seconds), to open it already signed in. */
    suspend fun webDashUrl(pid: String): String =
        Api.call("POST", "/v1/web/code", JSONObject(), pid).getString("url")

    suspend fun signOut(pid: String) {
        Api.call("POST", "/v1/signout", JSONObject(), pid)
    }

    suspend fun deleteAccount(pid: String) {
        Api.call("DELETE", "/v1/me", null, pid)
    }

    suspend fun list(pid: String): List<Reading> {
        val a = Api.call("GET", "/v1/bp?days=400", null, pid).getJSONArray("items")
        return (0 until a.length()).map {
            val o = a.getJSONObject(it)
            Reading(
                o.getString("id"), o.getLong("takenAt"), o.optString("period"),
                o.getInt("sis"), o.getInt("dia"), if (o.isNull("pul")) null else o.getInt("pul"),
                o.optString("source", "photo")
            )
        }.sortedBy { it.takenAt }
    }

    suspend fun me(pid: String): Me {
        val j = Api.call("GET", "/v1/me", null, pid)
        return Me(
            j.optBoolean("isAdmin", false), j.optString("billingMode", "private"),
            j.optBoolean("hasGoogle", false), if (j.isNull("email")) null else j.optString("email"), j.optBoolean("googleOn", false),
            j.optBoolean("disclaimerOk", true),
            j.optInt("appMinVersion", 0),
            parseSub(j.optJSONObject("sub")), j.optBoolean("subscriptionOn", false),
            j.optBoolean("ownerClaim", false)
        )
    }

    /** The owner's secret code, on a new phone: true when accepted. */
    suspend fun ownerClaim(pid: String, code: String) {
        Api.call("POST", "/v1/owner/claim", JSONObject().put("code", code), pid)
    }

    private fun parseSub(o: JSONObject?): Sub = if (o == null) Sub() else Sub(
        o.optBoolean("required", false), o.optBoolean("active", true),
        if (o.isNull("until") || !o.has("until")) null else o.optLong("until"), o.optString("state", ""),
        o.optString("scan", "on"), if (o.isNull("trialUntil") || !o.has("trialUntil")) null else o.optLong("trialUntil"),
        o.optBoolean("trialStarted", false),
        if (o.isNull("scansLeft") || !o.has("scansLeft")) null else o.optInt("scansLeft"),
        if (o.isNull("scansUsed") || !o.has("scansUsed")) null else o.optInt("scansUsed")
    )

    /** A purchase made in Google Play, checked by the server with Google Play. */
    suspend fun subVerify(pid: String, purchaseToken: String): Sub =
        parseSub(Api.call("POST", "/v1/sub/verify", JSONObject().put("purchaseToken", purchaseToken), pid).optJSONObject("sub"))

    /** Owner: the subscription on (everyone else pays) or off (free for everyone). */
    suspend fun setSubscriptionOn(pid: String, on: Boolean) {
        Api.call("POST", "/v1/admin/subscription", JSONObject().put("on", on), pid)
    }

    /** Is this version of the app still allowed? Asked when the app opens. null = no answer (offline): nothing changes. */
    suspend fun appAllowed(): Boolean? = withContext(Dispatchers.IO) {
        try {
            val c = URL(Server.base + "/v1/app-status?v=" + BuildConfig.VERSION_CODE).openConnection() as HttpURLConnection
            c.connectTimeout = 10000; c.readTimeout = 10000
            try {
                if (c.responseCode != 200) null
                else JSONObject(c.inputStream.bufferedReader().use { it.readText() }).optBoolean("ok", true)
            } finally { c.disconnect() }
        } catch (e: Exception) { null }
    }

    /** Administrator: switch off every app below [minVersion] (0 = let them all work again). */
    suspend fun setAppMinVersion(pid: String, minVersion: Int): Int =
        Api.call("POST", "/v1/admin/app-min-version", JSONObject().put("minVersion", minVersion), pid).optInt("appMinVersion", minVersion)

    /** Values said aloud, saved only after the person confirms; [spokenAt] is when they were said (checked by the server). */
    /** The three numbers read from a photo on this phone and confirmed by the person: the photo is not sent. */
    suspend fun photo(pid: String, sis: Int, dia: Int, pul: Int, takenAt: Long) {
        Api.call("POST", "/v1/bp/photo", JSONObject().put("sis", sis).put("dia", dia).put("pul", pul).put("takenAt", takenAt), pid)
    }

    /** The free photo Scan (terms v21): the server reads the display with the owner's key and answers the numbers or a retake reason. */
    suspend fun photoRead(pid: String, jpegB64: String): JSONObject =
        Api.call("POST", "/v1/bp/photo/read", JSONObject().put("image", jpegB64), pid)

    /** How a photo Scan ended when nothing was saved (retake reason, or "wrong"): a code only. Never fails. */
    suspend fun photoOutcome(pid: String, code: String) {
        try { Api.call("POST", "/v1/bp/photo/outcome", JSONObject().put("code", code), pid) } catch (_: Exception) { }
    }

    suspend fun voice(pid: String, sis: Int, dia: Int, pul: Int, spokenAt: Long) {
        Api.call("POST", "/v1/bp/voice", JSONObject().put("sis", sis).put("dia", dia).put("pul", pul).put("spokenAt", spokenAt), pid)
    }

    /** Deletes every blood-pressure reading of this person. */
    suspend fun deleteAll(pid: String) {
        Api.call("DELETE", "/v1/bp", null, pid)
    }

    suspend fun delete(pid: String, id: String) {
        Api.call("DELETE", "/v1/bp/$id", null, pid)
    }
}
