package ch.personalhealthy.app

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

object Notif {
    private const val CHANNEL = "credito" // keep: existing notification channel id
    private const val ID_LOW = 1001

    private fun ensureChannel(ctx: Context) {
        val nm = ctx.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CHANNEL, t(R.string.credit_title), NotificationManager.IMPORTANCE_DEFAULT))
    }

    /** Notifies once when the credit is enough for one more photo at most; re-arms after a top-up. */
    fun check(ctx: Context, c: Credit?, isAdmin: Boolean) {
        if (c == null || !c.configured) return
        val prefs = ctx.getSharedPreferences("battito", Context.MODE_PRIVATE) // keep: existing storage name
        if (!c.low) {
            prefs.edit().putBoolean("lowNotified", false).apply()
            return
        }
        if (prefs.getBoolean("lowNotified", false)) return
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return

        if (Txt.res == null) Txt.init(ctx)
        ensureChannel(ctx)
        val what = if (c.empty) t(R.string.notif_empty) else t(R.string.notif_low)
        val body = what + " " + if (isAdmin) t(R.string.notif_admin_hint) else t(R.string.notif_user_hint)
        val open = PendingIntent.getActivity(
            ctx, 0, Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val n = NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ic_notify)
            .setContentTitle(t(R.string.notif_title))
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()
        try {
            NotificationManagerCompat.from(ctx).notify(ID_LOW, n)
            prefs.edit().putBoolean("lowNotified", true).apply()
        } catch (e: SecurityException) {
            // permission denied: we will try again at the next check
        }
    }

    /** Hourly check, even with the app closed: so it warns even when another family member uses up the credit. */
    fun schedule(ctx: Context) {
        val req = PeriodicWorkRequestBuilder<CreditWorker>(1, TimeUnit.HOURS)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        // keep the existing job name: renaming it would schedule a duplicate job
        WorkManager.getInstance(ctx).enqueueUniquePeriodicWork("controllo-credito", ExistingPeriodicWorkPolicy.KEEP, req)
    }
}

class CreditWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result {
        if (Txt.res == null) Txt.init(applicationContext)
        val pid = applicationContext.getSharedPreferences("battito", Context.MODE_PRIVATE).getString("personId", null)
            ?: return Result.success()
        return try {
            val me = Repo.me(pid)
            Notif.check(applicationContext, me.credit, me.isAdmin)
            Result.success()
        } catch (e: Exception) {
            Result.success()
        }
    }
}
