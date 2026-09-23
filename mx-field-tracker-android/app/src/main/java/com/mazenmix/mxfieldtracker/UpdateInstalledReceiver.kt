package com.mazenmix.mxfieldtracker

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

class UpdateInstalledReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != Intent.ACTION_MY_PACKAGE_REPLACED) return

        val launch = context.packageManager
            .getLaunchIntentForPackage(context.packageName)
            ?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

        try {
            if (launch != null) {
                context.startActivity(launch)
                return
            }
        } catch (_: Exception) {
        }

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
            503,
            Intent(context, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            android.app.Notification.Builder(context, channelId)
        } else {
            android.app.Notification.Builder(context)
        }
            .setSmallIcon(R.drawable.ic_launcher)
            .setContentTitle("MX Field Tracker updated")
            .setContentText("Update installed successfully. Tap to reopen.")
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()

        manager.notify(504, notification)
    }
}