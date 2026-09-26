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

/** Translated text (English, Italian, German or French, following the phone). */
fun t(id: Int, vararg args: Any): String = Txt.res?.getString(id, *args) ?: ""

fun periodLabel(p: String): String = when (p) {
    "morning" -> t(R.string.period_morning)
    "afternoon" -> t(R.string.period_afternoon)
    "evening" -> t(R.string.period_evening)
    else -> p
}

/* ---------------- Models ---------------- */

data class Reading(val id: String, val takenAt: Long, val period: String, val sis: Int, val dia: Int, val pul: Int?)

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

/** One credit movement: kind = "topup", "set" (balance corrected) or "usage" (one photo read). */
data class Movement(val kind: String, val amount: Double, val at: Long)

data class Me(val isAdmin: Boolean, val billingMode: String, val credit: Credit?)

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
    data class Failed(val msg: String) : ScanState()
}

enum class Level(private val labelRes: Int, val color: Long) {
    OK(R.string.level_ok, 0xFF4FD9A6),
    WARN(R.string.level_warn, 0xFFFFB35C),
    ALERT(R.string.level_alert, 0xFFFF6178),
    LOW(R.string.level_low, 0xFFA99BFF);

    val label: String get() = t(labelRes)
}

const val THRESHOLD_SYS = 135
const val THRESHOLD_DIA = 85

fun classify(s: Int, d: Int): Level = when {
    s >= 160 || d >= 100 -> Level.ALERT
    s >= THRESHOLD_SYS || d >= THRESHOLD_DIA -> Level.WARN
    s < 90 || d < 60 -> Level.LOW
    else -> Level.OK
}

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
    val maxS: Reading?, val maxD: Reading?, val minS: Reading?, val over: Int
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
        maxS = list.maxByOrNull { it.sis }, maxD = list.maxByOrNull { it.dia }, minS = list.minByOrNull { it.sis },
        over = list.count { it.sis >= THRESHOLD_SYS || it.dia >= THRESHOLD_DIA }
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
    "unauthorized", "bad_key" -> t(R.string.err_unauthorized)
    "photo_time" -> t(R.string.err_photo_time)
    "no_photo" -> t(R.string.err_no_photo)
    "credit_empty" -> t(R.string.err_credit_empty)
    "read_failed" -> t(R.string.err_read_failed)
    "not_found" -> t(R.string.err_not_found)
    "already_saved" -> t(R.string.err_already_saved)
    "scan_expired" -> t(R.string.err_scan_expired)
    "scan_invalid" -> t(R.string.err_scan_invalid)
    "admin_only" -> t(R.string.err_admin_only)
    "bad_amount" -> t(R.string.err_bad_amount)
    "mode_unavailable" -> t(R.string.err_mode_unavailable)
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
        val body = JSONObject().put("familyCode", code).put("publicKey", Keys.publicKeyB64())
        return Api.call("POST", "/v1/register", body, null).getString("personId")
    }

    suspend fun list(pid: String): List<Reading> {
        val a = Api.call("GET", "/v1/bp?days=400", null, pid).getJSONArray("items")
        return (0 until a.length()).map {
            val o = a.getJSONObject(it)
            Reading(
                o.getString("id"), o.getLong("takenAt"), o.optString("period"),
                o.getInt("sis"), o.getInt("dia"), if (o.isNull("pul")) null else o.getInt("pul")
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
        return Me(j.optBoolean("isAdmin", false), j.optString("billingMode", "private"), parseCredit(j.optJSONObject("credit")))
    }

    /** action = "topup" (add a top-up) or "set" (set the current balance) */
    suspend fun credit(pid: String, action: String, amount: Double): Credit? {
        val j = Api.call("POST", "/v1/admin/credit", JSONObject().put("action", action).put("amount", amount), pid)
        return parseCredit(j.optJSONObject("credit"))
    }

    suspend fun creditHistory(pid: String): List<Movement> {
        val a = Api.call("GET", "/v1/credit/history", null, pid).getJSONArray("items")
        return (0 until a.length()).map {
            val o = a.getJSONObject(it)
            Movement(o.getString("kind"), o.getDouble("amount"), o.getLong("at"))
        }
    }

    suspend fun setBilling(pid: String, mode: String) {
        Api.call("POST", "/v1/admin/settings", JSONObject().put("billingMode", mode), pid)
    }

    suspend fun confirm(pid: String, scanId: String) {
        Api.call("POST", "/v1/bp/confirm", JSONObject().put("scanId", scanId), pid)
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
