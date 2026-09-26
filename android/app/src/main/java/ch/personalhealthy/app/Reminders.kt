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
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import java.time.Duration
import java.time.LocalTime
import java.time.ZonedDateTime
import java.util.concurrent.TimeUnit

/**
 * Two reminders a day to measure blood pressure: morning and evening, at the phone's local time.
 * Each reminder is a one-time job that schedules the next day's one when it runs,
 * so the time does not drift. WorkManager keeps them after a restart of the phone.
 * The text follows the phone's language, like the rest of the app.
 */
object Reminders {
    private const val CHANNEL = "reminders"
    private val TIMES = mapOf("morning" to LocalTime.of(8, 0), "evening" to LocalTime.of(20, 0))

    /** Called at every start of the app: KEEP leaves an already planned reminder as it is. */
    fun schedule(ctx: Context) {
        TIMES.keys.forEach { plan(ctx, it, ExistingWorkPolicy.KEEP) }
    }

    fun plan(ctx: Context, which: String, policy: ExistingWorkPolicy) {
        val at = TIMES.getValue(which)
        val now = ZonedDateTime.now()
        var next = now.with(at).withSecond(0).withNano(0)
        if (!next.isAfter(now.plusMinutes(1))) next = next.plusDays(1)
        val req = OneTimeWorkRequestBuilder<ReminderWorker>()
            .setInitialDelay(Duration.between(now, next).toMillis(), TimeUnit.MILLISECONDS)
            .setInputData(workDataOf("which" to which))
            .build()
        WorkManager.getInstance(ctx).enqueueUniqueWork("reminder-$which", policy, req)
    }

    fun show(ctx: Context, which: String) {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        if (Txt.res == null) Txt.init(ctx)
        val nm = ctx.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CHANNEL, t(R.string.reminder_channel), NotificationManager.IMPORTANCE_DEFAULT))
        val open = PendingIntent.getActivity(
            ctx, 1, Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val body = t(if (which == "morning") R.string.reminder_morning else R.string.reminder_evening)
        val n = NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ic_notify)
            .setContentTitle(t(R.string.reminder_title))
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()
        try {
            NotificationManagerCompat.from(ctx).notify(if (which == "morning") 2001 else 2002, n)
        } catch (e: SecurityException) {
            // notifications not allowed: nothing to do
        }
    }
}

class ReminderWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result {
        val which = inputData.getString("which") ?: return Result.success()
        // only for a phone that has been activated
        if (applicationContext.getSharedPreferences("battito", Context.MODE_PRIVATE).getString("personId", null) != null) {
            Reminders.show(applicationContext, which)
        }
        Reminders.plan(applicationContext, which, ExistingWorkPolicy.APPEND_OR_REPLACE)
        return Result.success()
    }
}
