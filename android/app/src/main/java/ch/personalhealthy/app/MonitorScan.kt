package ch.personalhealthy.app

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import androidx.exifinterface.media.ExifInterface
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.coroutines.suspendCoroutine
import kotlin.math.abs
import kotlin.math.min

/**
 * The photo Scan of the blood-pressure monitor, entirely on the phone, without any AI service: the photo is read by
 * MonitorReader (the seven segments of each digit) and, when that is not sure, by the phone's own text recognizer
 * (ML Kit, bundled in the app, already used for the lab reports). Whatever is read is always shown to the person next
 * to the photo, and saved only after they confirm it. The photo never leaves the phone and is deleted afterwards.
 */
object MonitorScan {
    sealed class Result {
        /** by: "segments" (MonitorReader) or "text" (the phone's text recognizer). */
        data class Values(val sys: Int, val dia: Int, val pul: Int, val by: String) : Result()
        /** reason: dark, glare, blurry, not_found, unclear, implausible (see MonitorRead). */
        data class Retake(val reason: String) : Result()
    }

    /** The photo, turned the right way up and small enough to read and to show (longest side 1600). */
    suspend fun load(file: File): Bitmap = withContext(Dispatchers.IO) {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.path, bounds)
        require(bounds.outWidth > 0 && bounds.outHeight > 0) { "photo_unreadable" }
        var sample = 1
        while (maxOf(bounds.outWidth, bounds.outHeight) / sample > 3200) sample *= 2
        val raw = BitmapFactory.decodeFile(file.path, BitmapFactory.Options().apply { inSampleSize = sample }) ?: error("photo_unreadable")
        val orientation = runCatching { ExifInterface(file).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL) }
            .getOrDefault(ExifInterface.ORIENTATION_NORMAL)
        val m = Matrix()
        when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> m.setRotate(90f)
            ExifInterface.ORIENTATION_ROTATE_180 -> m.setRotate(180f)
            ExifInterface.ORIENTATION_ROTATE_270 -> m.setRotate(-90f)
        }
        val f = min(1f, 1600f / maxOf(raw.width, raw.height))
        if (f < 1f) m.postScale(f, f)
        if (m.isIdentity) raw else Bitmap.createBitmap(raw, 0, 0, raw.width, raw.height, m, true).also { if (it !== raw) raw.recycle() }
    }

    suspend fun read(bitmap: Bitmap): Result {
        val first = withContext(Dispatchers.Default) { MonitorReader.read(gray(bitmap)) }
        if (first is MonitorRead.Ok) return Result.Values(first.sys, first.dia, first.pul, "segments")
        val reason = (first as MonitorRead.Retake).reason
        // a photo too dark, burnt by a reflection or out of focus is not tried again: a new photo is the answer
        if (reason == "dark" || reason == "glare" || reason == "blurry") return Result.Retake(reason)
        val text = try { byText(bitmap) } catch (e: Exception) { ErrorReport.report("Scan/text", e); null }
        return text ?: Result.Retake(reason)
    }

    /** Grey levels of the photo (luminance), for MonitorReader. */
    private fun gray(b: Bitmap): GrayImage {
        val w = b.width; val h = b.height
        val px = IntArray(w * h)
        b.getPixels(px, 0, w, 0, 0, w, h)
        for (i in px.indices) { val c = px[i]; px[i] = (299 * ((c shr 16) and 255) + 587 * ((c shr 8) and 255) + 114 * (c and 255)) / 1000 }
        return GrayImage(w, h, px)
    }

    /**
     * The phone's text recognizer: numbers of two or three digits and where they are. The same layout rule as
     * MonitorReader: SYS and DIA are the largest pair of numbers of the same size, one above the other; the pulse is
     * the nearest number below them. Anything not certain (two candidates, a value out of range) gives null.
     */
    private suspend fun byText(bitmap: Bitmap): Result.Values? {
        data class N(val v: Int, val l: Int, val t: Int, val r: Int, val b: Int) { val h = b - t; val cy = (t + b) / 2 }
        val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        val nums = try {
            suspendCoroutine<List<N>> { cont ->
                recognizer.process(InputImage.fromBitmap(bitmap, 0))
                    .addOnSuccessListener { res ->
                        cont.resume(res.textBlocks.flatMap { it.lines }.flatMap { it.elements }.mapNotNull { e ->
                            val box = e.boundingBox ?: return@mapNotNull null
                            if (!Regex("^[1-9][0-9]{1,2}$").matches(e.text)) null else N(e.text.toInt(), box.left, box.top, box.right, box.bottom)
                        })
                    }
                    .addOnFailureListener { cont.resumeWithException(it) }
            }
        } finally { recognizer.close() }
        var best: Pair<N, N>? = null; var score = 0; var second = 0
        for (up in nums) for (dn in nums) {
            if (up === dn || dn.t <= up.cy || dn.t - up.b > up.h) continue
            if (dn.h.toDouble() / up.h !in 0.8..1.25) continue
            if (min(up.r, dn.r) - maxOf(up.l, dn.l) < 0.3 * min(up.r - up.l, dn.r - dn.l)) continue
            val s = min(up.h, dn.h)
            if (s > score) { second = score; score = s; best = up to dn } else if (s > second) second = s
        }
        val (sys, dia) = best ?: return null
        if (second >= 0.85 * score) return null   // two pairs almost as large: which one is the pressure is not sure
        val below = nums.filter { it !== sys && it !== dia && it.cy > dia.cy && it.h >= 0.3 * dia.h }
        val pul = below.minByOrNull { it.cy } ?: return null
        if (below.any { it !== pul && abs(it.cy - pul.cy) < 0.5 * pul.h }) return null   // the pulse's row has a second number (a clock)
        if (sys.v !in 60..260 || dia.v !in 30..160 || dia.v >= sys.v || sys.v - dia.v < 10 || pul.v !in 30..220) return null
        return Result.Values(sys.v, dia.v, pul.v, "text")
    }
}
