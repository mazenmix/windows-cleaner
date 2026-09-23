package com.mazenmix.mxfieldtracker

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != Intent.ACTION_BOOT_COMPLETED) return

        val prefs =
            context.getSharedPreferences("mx_tracker", Context.MODE_PRIVATE)

        if (!prefs.getBoolean("tracking", false)) return

        val service = Intent(context, TrackerService::class.java)
            .setAction(TrackerService.ACTION_START)
            .putExtra("resume_existing", true)

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(service)
            } else {
                context.startService(service)
            }
        } catch (_: Exception) {
        }
    }
}