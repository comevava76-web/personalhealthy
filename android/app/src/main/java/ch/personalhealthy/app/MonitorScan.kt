package ch.personalhealthy.app

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import androidx.exifinterface.media.ExifInterface
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import kotlin.math.min

/**
 * The photo of the blood-pressure monitor: loaded the right way up here, read by the person's own AI provider
 * (AiScan, terms v21). The on-phone reader (MonitorReader, ML Kit) was not reliable on real displays and is no longer
 * used (decision of Human, 02.10.2026). Whatever is read is shown next to the photo and saved only after the person
 * confirms it; the photo is deleted afterwards.
 */
object MonitorScan {
    sealed class Result {
        /** by: "ai" (read with AI through the server). */
        data class Values(val sys: Int, val dia: Int, val pul: Int, val by: String) : Result()
        /** reason: dark, glare, blurry, not_found, unclear, implausible; ai_key, ai_quota, ai_network, ai_error. */
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
}
