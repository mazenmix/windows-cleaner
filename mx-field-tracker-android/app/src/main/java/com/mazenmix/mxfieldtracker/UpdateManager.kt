package com.mazenmix.mxfieldtracker

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

data class UpdateInfo(
    val versionCode: Int,
    val versionName: String,
    val apkUrl: String,
    val notes: String
)

object UpdateManager {
    const val UPDATE_JSON_URL =
        "https://mxtracker-5xy.pages.dev/update.json"

    fun check(
        context: Context,
        callback: (UpdateInfo?, Throwable?) -> Unit
    ) {
        Thread {
            try {
                val conn = (URL(UPDATE_JSON_URL).openConnection() as HttpURLConnection).apply {
                    connectTimeout = 8000
                    readTimeout = 8000
                    requestMethod = "GET"
                    setRequestProperty("Cache-Control", "no-cache")
                    setRequestProperty("User-Agent", "MXFieldTracker/1.2")
                }

                val code = conn.responseCode
                if (code !in 200..299) {
                    conn.disconnect()
                    throw IllegalStateException("Update server HTTP " + code)
                }

                val text = conn.inputStream.bufferedReader().use { it.readText() }
                conn.disconnect()

                val j = JSONObject(text)
                val info = UpdateInfo(
                    versionCode = j.getInt("versionCode"),
                    versionName = j.getString("versionName"),
                    apkUrl = j.getString("apkUrl"),
                    notes = j.optString("notes", "")
                )

                callback(info, null)
            } catch (e: Throwable) {
                callback(null, e)
            }
        }.start()
    }

    fun isNewer(info: UpdateInfo): Boolean =
        info.versionCode > BuildConfig.VERSION_CODE

    fun canInstallPackages(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
            context.packageManager.canRequestPackageInstalls()

    fun openInstallPermission(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val intent = Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + context.packageName)
            ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        }
    }

    fun downloadAndInstall(
        context: Context,
        info: UpdateInfo,
        onProgress: (Int) -> Unit,
        onError: (Throwable) -> Unit
    ) {
        Thread {
            try {
                val dir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
                    ?: throw IllegalStateException("Download folder unavailable")
                if (!dir.exists()) dir.mkdirs()

                val apk = File(dir, "MX_Field_Tracker_Update.apk")
                if (apk.exists()) apk.delete()

                val conn = (URL(info.apkUrl).openConnection() as HttpURLConnection).apply {
                    connectTimeout = 12000
                    readTimeout = 20000
                    requestMethod = "GET"
                    setRequestProperty("Cache-Control", "no-cache")
                    setRequestProperty("User-Agent", "MXFieldTracker/1.2")
                }

                val total = conn.contentLengthLong
                if (conn.responseCode !in 200..299) {
                    val code = conn.responseCode
                    conn.disconnect()
                    throw IllegalStateException("APK download HTTP " + code)
                }

                conn.inputStream.use { input ->
                    FileOutputStream(apk).use { output ->
                        val buffer = ByteArray(32 * 1024)
                        var read: Int
                        var done = 0L

                        while (input.read(buffer).also { read = it } >= 0) {
                            if (read == 0) continue
                            output.write(buffer, 0, read)
                            done += read

                            if (total > 0) {
                                val pct = ((done * 100L) / total).toInt()
                                onProgress(pct.coerceIn(0, 100))
                            }
                        }
                    }
                }
                conn.disconnect()

                installDownloadedApk(context, apk)
            } catch (e: Throwable) {
                onError(e)
            }
        }.start()
    }

    private fun installDownloadedApk(context: Context, apk: File) {
        val uri = FileProvider.getUriForFile(
            context,
            context.packageName + ".fileprovider",
            apk
        )

        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }

    fun showUpdateAvailableNotification(
        context: Context,
        info: UpdateInfo
    ) {
        val manager = context.getSystemService(NotificationManager::class.java)
        val channelId = "mx_updates"

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                NotificationChannel(
                    channelId,
                    "MX Field Tracker updates",
                    NotificationManager.IMPORTANCE_DEFAULT
                )
            )
        }

        val open = PendingIntent.getActivity(
            context,
            501,
            Intent(context, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            android.app.Notification.Builder(context, channelId)
        } else {
            android.app.Notification.Builder(context)
        }
            .setSmallIcon(R.drawable.ic_launcher)
            .setContentTitle("MX Field Tracker update available")
            .setContentText("Version " + info.versionName + " is ready to install.")
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()

        manager.notify(502, notification)
    }
}