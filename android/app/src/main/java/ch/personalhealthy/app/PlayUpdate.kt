package ch.personalhealthy.app

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.UpdateAvailability

/**
 * Updates the way every app on Google Play does (decision of Human: only one version is kept). When Google Play has a
 * newer HINT 365, Google's own full-screen "Update" window opens inside the app (immediate in-app update), at every
 * start and every return to the app, until the person updates. No page of ours.
 * It works only for an app installed from Google Play: an APK installed from the download link (the test phase)
 * falls back to the download link.
 */
object PlayUpdate {
    private const val REQUEST = 4711

    /** Installed by Google Play (not from the download link). */
    fun fromPlay(ctx: Context): Boolean = try {
        val installer = if (Build.VERSION.SDK_INT >= 30) ctx.packageManager.getInstallSourceInfo(ctx.packageName).installingPackageName
            else @Suppress("DEPRECATION") ctx.packageManager.getInstallerPackageName(ctx.packageName)
        installer == "com.android.vending"
    } catch (_: Exception) { false }

    /** Asks Google Play whether a newer version exists and, if so, opens Google's update window. Never throws. */
    fun check(activity: Activity) {
        if (!fromPlay(activity)) return
        try {
            val manager = AppUpdateManagerFactory.create(activity)
            manager.appUpdateInfo.addOnSuccessListener { info ->
                val available = info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE ||
                    info.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS
                if (available && info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)) try {
                    manager.startUpdateFlowForResult(info, activity, AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build(), REQUEST)
                } catch (e: Exception) { ErrorReport.report("PlayUpdate/start", e) }
            }
        } catch (e: Exception) { ErrorReport.report("PlayUpdate/check", e) }
    }

    /** The server says this version is no longer used: Google's update window, or, outside Google Play, the download link. */
    fun update(activity: Activity) {
        // from Google Play: its page for HINT 365, with the Update button (the update window has already been offered)
        if (fromPlay(activity)) try {
            activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + activity.packageName)))
        } catch (_: Exception) { check(activity) }
        else try {
            activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(DOWNLOAD_URL)))
        } catch (_: Exception) { android.widget.Toast.makeText(activity, t(R.string.no_browser), android.widget.Toast.LENGTH_LONG).show() }
    }
}
