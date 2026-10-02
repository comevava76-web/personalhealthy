package ch.personalhealthy.app

import android.graphics.Bitmap
import android.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.ByteArrayOutputStream

/**
 * The photo Scan with AI (terms v21, decided by Human). The photo of the display goes to HINT 365's server, which asks
 * the owner's AI provider (today Claude Haiku, with the owner's key) and passes back three numbers; the server keeps
 * neither the photo nor the answer. Nobody adds a key on the phone: the owner pays; the person has the 15-day trial,
 * then the AI features subscription (3 a day, at most 2.50 US$ of AI a year).
 * The numbers are always shown to the person and saved only after they confirm them (MainActivity, PhotoScreen).
 */
object AiScan {
    /** Reads SYS, DIA and pulse from the photo of the display, through HINT 365's server. */
    suspend fun read(pid: String?, photo: Bitmap): MonitorScan.Result = withContext(Dispatchers.IO) {
        if (pid == null) return@withContext MonitorScan.Result.Retake("ai_error")
        val r = try { Repo.photoRead(pid, jpegBase64(photo)) } catch (e: ApiException) {
            return@withContext MonitorScan.Result.Retake(when (e.code) {
                "scan_quota" -> "quota_free"
                "scan_budget" -> "quota_year"
                "scan_locked" -> "locked"
                "network" -> "ai_network"
                else -> "ai_error"
            })
        }
        parse(r.toString())
    }

    /** The JSON in the answer, checked like the other inputs: plausible values only, otherwise a new photo. */
    internal fun parse(answer: String): MonitorScan.Result {
        val start = answer.indexOf('{'); val end = answer.lastIndexOf('}')
        if (start < 0 || end <= start) return MonitorScan.Result.Retake("unclear")
        val o = try { JSONObject(answer.substring(start, end + 1)) } catch (e: Exception) { return MonitorScan.Result.Retake("unclear") }
        if (o.has("retake")) {
            val r = o.optString("retake")
            return MonitorScan.Result.Retake(if (r in setOf("not_found", "unclear", "glare", "dark", "blurry", "implausible")) r else "unclear")
        }
        val sys = o.optInt("sys", -1); val dia = o.optInt("dia", -1); val pul = o.optInt("pul", -1)
        if (sys !in 60..260 || dia !in 30..160 || dia >= sys || sys - dia < 10 || pul !in 30..220) return MonitorScan.Result.Retake("implausible")
        return MonitorScan.Result.Values(sys, dia, pul, "ai")
    }

    /** The photo for the server: longest side 1280 pixels, JPEG; the display stays readable and the request small. */
    private fun jpegBase64(b: Bitmap): String {
        val f = minOf(1f, 1280f / maxOf(b.width, b.height))
        val s = if (f < 1f) Bitmap.createScaledBitmap(b, (b.width * f).toInt(), (b.height * f).toInt(), true) else b
        val out = ByteArrayOutputStream()
        s.compress(Bitmap.CompressFormat.JPEG, 88, out)
        if (s !== b) s.recycle()
        return Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
    }
}
