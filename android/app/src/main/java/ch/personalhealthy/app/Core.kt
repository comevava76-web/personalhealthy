package ch.personalhealthy.app

import android.content.Context
import android.content.res.Resources
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.exifinterface.media.ExifInterface
import kotlinx.coroutines.Dispatchers
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

object Txt {
    @Volatile var res: Resources? = null
    fun init(ctx: Context) { res = ctx.resources }
}

/** Where anyone can download the latest app (the server publishes it; the repository is private). */
val DOWNLOAD_URL: String get() = BuildConfig.API_URL.trimEnd('/') + "/download"

/** Opens the phone's share sheet with the app's download link, to send to a friend. */
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

/** Translated text (English, Italian, German or French, following the phone). */
fun t(id: Int, vararg args: Any): String = Txt.res?.getString(id, *args) ?: ""

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
        val n = Regex("\\d{2,3}").findAll(text).map { it.value.toInt() }.toList()
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

data class ScanResult(
    val scanId: String, val readable: Boolean, val sis: Int?, val dia: Int?, val pul: Int?,
    val note: String, val takenAt: Long, val period: String, val credit: Credit?
)

/**
 * Credit for AI readings, kept by the server (in dollars).
 * loaded, spent and scans count from the last balance correction ([since], null if there was none).
 */
data class Credit(
    val configured: Boolean, val remaining: Double?, val avgCost: Double,
    val photosLeft: Int?, val low: Boolean, val empty: Boolean,
    val loaded: Double?, val spent: Double, val scans: Int, val since: Long?
)

/**
 * Who this phone is. [pays] = "owner": the app manager's key and credit pay for the photos;
 * "self": a friend who pays with their own Anthropic key ([hasKey] says whether it is stored on the server).
 * [credit] is always this person's own pool: friends never see the manager's, and the other way round.
 */
/** [hasGoogle]: the account is linked to a Google account ([email]), so it can be found again on a new phone. */
data class Me(
    val isAdmin: Boolean, val billingMode: String, val credit: Credit?, val pays: String = "owner", val hasKey: Boolean = false,
    val hasGoogle: Boolean = false, val email: String? = null, val googleOn: Boolean = false
) {
    val selfPays: Boolean get() = pays == "self"
    /** Can add money and correct the balance of their own pool: the app manager, or a friend. */
    val canRecharge: Boolean get() = isAdmin || selfPays
}

fun parseCredit(o: JSONObject?): Credit? = o?.let {
    Credit(
        configured = it.optBoolean("configured", false),
        remaining = if (it.isNull("remaining")) null else it.getDouble("remaining"),
        avgCost = it.optDouble("avgCost", 0.006),
        photosLeft = if (it.isNull("photosLeft")) null else it.getInt("photosLeft"),
        low = it.optBoolean("low", false),
        empty = it.optBoolean("empty", false),
        loaded = if (it.isNull("loaded")) null else it.getDouble("loaded"),
        spent = it.optDouble("spent", 0.0),
        scans = it.optInt("scans", 0),
        since = if (it.isNull("since")) null else it.getLong("since")
    )
}

fun usd(v: Double): String = String.format(Locale.getDefault(), "%.2f $", v)
fun usdFine(v: Double): String = String.format(Locale.getDefault(), "%.4f $", v)

sealed class ScanState {
    object Idle : ScanState()
    object Loading : ScanState()
    data class Done(val r: ScanResult) : ScanState()
    data class Failed(val msg: String, val code: String? = null) : ScanState()
}

/** Amber of the short warning lines (credit low, key missing). */
const val WARN_COLOR = 0xFFFFB35C

/* ---------------- Dates and times (Lugano time) ---------------- */

object Z {
    val zone: ZoneId = ZoneId.of("Europe/Zurich")
    private fun loc(): Locale = Locale.getDefault()

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

fun errorText(code: String): String = when (code) {
    "bad_clock" -> t(R.string.err_bad_clock)
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
    private val base = BuildConfig.API_URL.trimEnd('/')

    private fun sha256Hex(b: ByteArray): String =
        MessageDigest.getInstance("SHA-256").digest(b).joinToString("") { "%02x".format(it) }

    suspend fun call(method: String, path: String, body: JSONObject?, personId: String?): JSONObject =
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
                c.setRequestProperty("X-Lang", Locale.getDefault().language)
                if (personId != null) c.setRequestProperty("X-Person", personId)
                if (body != null) {
                    c.doOutput = true
                    c.setRequestProperty("Content-Type", "application/json")
                    c.outputStream.use { it.write(bytes) }
                }
                val code = c.responseCode
                val stream = if (code in 200..299) c.inputStream else c.errorStream
                val txt = stream?.bufferedReader()?.use { it.readText() } ?: ""
                val j = try { JSONObject(txt) } catch (e: Exception) { JSONObject() }
                if (code !in 200..299) throw ApiException(j.optString("code", if (code >= 500) "server" else "generic"))
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

    suspend fun scan(pid: String, image: String, takenAt: Long): ScanResult {
        val j = Api.call("POST", "/v1/bp/scan", JSONObject().put("image", image).put("takenAt", takenAt), pid)
        fun n(k: String): Int? = if (j.isNull(k)) null else j.getInt(k)
        return ScanResult(
            j.getString("scanId"), j.optBoolean("readable", false), n("sis"), n("dia"), n("pul"),
            j.optString("note", ""), j.getLong("takenAt"), j.optString("period", ""),
            parseCredit(j.optJSONObject("credit"))
        )
    }

    suspend fun me(pid: String): Me {
        val j = Api.call("GET", "/v1/me", null, pid)
        return Me(
            j.optBoolean("isAdmin", false), j.optString("billingMode", "private"), parseCredit(j.optJSONObject("credit")),
            j.optString("pays", "owner"), j.optBoolean("hasKey", false),
            j.optBoolean("hasGoogle", false), if (j.isNull("email")) null else j.optString("email"), j.optBoolean("googleOn", false)
        )
    }

    /** action = "topup" (add a top-up) or "set" (set the current balance), always on this person's own pool */
    suspend fun credit(pid: String, action: String, amount: Double): Credit? {
        val j = Api.call("POST", "/v1/credit", JSONObject().put("action", action).put("amount", amount), pid)
        return parseCredit(j.optJSONObject("credit"))
    }

    /**
     * A friend's own Anthropic key: the server tests it with a tiny request, then stores it encrypted.
     * It is never sent back to the phone. [amount] = the balance shown on Anthropic now (null = unchanged).
     */
    suspend fun saveKey(pid: String, apiKey: String, amount: Double?): Credit? {
        val body = JSONObject().put("apiKey", apiKey)
        if (amount != null) body.put("amount", amount)
        return parseCredit(Api.call("POST", "/v1/key", body, pid).optJSONObject("credit"))
    }

    suspend fun deleteKey(pid: String) {
        Api.call("DELETE", "/v1/key", null, pid)
    }

    suspend fun confirm(pid: String, scanId: String) {
        Api.call("POST", "/v1/bp/confirm", JSONObject().put("scanId", scanId), pid)
    }

    /** Values said aloud, saved only after the person confirms; [spokenAt] is when they were said (checked by the server). */
    suspend fun voice(pid: String, sis: Int, dia: Int, pul: Int, spokenAt: Long) {
        Api.call("POST", "/v1/bp/voice", JSONObject().put("sis", sis).put("dia", dia).put("pul", pul).put("spokenAt", spokenAt), pid)
    }

    /** Deletes every measurement and photo reading of this person (the credit stays). */
    suspend fun deleteAll(pid: String) {
        Api.call("DELETE", "/v1/bp", null, pid)
    }

    suspend fun delete(pid: String, id: String) {
        Api.call("DELETE", "/v1/bp/$id", null, pid)
    }
}

/* ---------------- Photo preparation ---------------- */

object Img {
    fun prepare(f: File): String {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(f.path, bounds)
        var sample = 1
        while (max(bounds.outWidth, bounds.outHeight) / sample > 3200) sample *= 2
        val bmp = BitmapFactory.decodeFile(f.path, BitmapFactory.Options().apply { inSampleSize = sample })
            ?: throw ApiException("photo_unreadable")
        val rot = when (ExifInterface(f.path).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
            ExifInterface.ORIENTATION_ROTATE_90 -> 90f
            ExifInterface.ORIENTATION_ROTATE_180 -> 180f
            ExifInterface.ORIENTATION_ROTATE_270 -> 270f
            else -> 0f
        }
        val scale = min(1f, 1600f / max(bmp.width, bmp.height))
        val m = Matrix().apply { postScale(scale, scale); postRotate(rot) }
        val out = Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, m, true)
        val bos = ByteArrayOutputStream()
        out.compress(Bitmap.CompressFormat.JPEG, 85, bos)
        return Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP)
    }
}
