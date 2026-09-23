package com.mazenmix.mxfieldtracker

import android.Manifest
import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.*
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class TrackerService : Service(), LocationListener {

    companion object {
        const val ACTION_START = "com.mazenmix.mxfieldtracker.START"
        const val ACTION_STOP = "com.mazenmix.mxfieldtracker.STOP"
        private const val CHANNEL_ID = "mx_tracking"
        private const val NOTIFICATION_ID = 73
    }

    private lateinit var prefs: android.content.SharedPreferences
    private lateinit var locationManager: LocationManager
    private lateinit var queue: QueueDb
    private val executor = Executors.newSingleThreadExecutor()
    private var lastAcceptedAt = 0L

    override fun onCreate() {
        super.onCreate()
        prefs = getSharedPreferences("mx_tracker", MODE_PRIVATE)
        queue = QueueDb(this)
        locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            prefs.edit().putBoolean("tracking", false).apply()
            try { locationManager.removeUpdates(this) } catch (_: Exception) {}

            executor.execute {
                sendShiftEventBlocking("end")
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
            return START_NOT_STICKY
        }

        if (!prefs.getBoolean("tracking", false) && intent?.action != ACTION_START) {
            return START_NOT_STICKY
        }

        prefs.edit().putBoolean("tracking", true).apply()
        startForeground(NOTIFICATION_ID, buildNotification())
        startLocationUpdates()

        val resumeExisting =
            intent?.getBooleanExtra("resume_existing", false) == true
        val manualStart =
            intent?.action == ACTION_START && !resumeExisting

        if (manualStart) {
            sendShiftEvent("start")
        }

        flushQueue()
        return START_STICKY
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Work location tracking",
                NotificationManager.IMPORTANCE_LOW
            )
            channel.description =
                "Shown while your work shift location is being shared."
            getSystemService(NotificationManager::class.java)
                .createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val open = PendingIntent.getActivity(
            this,
            1,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val stop = PendingIntent.getService(
            this,
            2,
            Intent(this, TrackerService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return Notification.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher)
            .setContentTitle("MX Field Tracker • LIVE")
            .setContentText("Work-shift background location tracking is active")
            .setContentIntent(open)
            .setOngoing(true)
            .addAction(
                android.R.drawable.ic_media_pause,
                "END SHIFT",
                stop
            )
            .build()
    }

    private fun startLocationUpdates() {
        if (
            checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) !=
            PackageManager.PERMISSION_GRANTED
        ) return

        try {
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER,
                    5000L,
                    4f,
                    this
                )
            }

            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER,
                    10000L,
                    10f,
                    this
                )
            }
        } catch (_: Exception) {}
    }

    override fun onLocationChanged(location: Location) {
        val now = System.currentTimeMillis()
        if (now - lastAcceptedAt < 4500L) return
        lastAcceptedAt = now

        updateLocalShiftStats(location)
        queue.add(locationPayload(location).toString())
        flushQueue()
    }

    private fun updateLocalShiftStats(location: Location) {
        val points = prefs.getInt("shift_points", 0)
        var distance = prefs.getFloat("shift_distance_m", 0f)

        if (prefs.contains("last_lat") && prefs.contains("last_lng")) {
            val lastLat = java.lang.Double.longBitsToDouble(
                prefs.getLong("last_lat", 0L)
            )
            val lastLng = java.lang.Double.longBitsToDouble(
                prefs.getLong("last_lng", 0L)
            )

            val result = FloatArray(1)
            Location.distanceBetween(
                lastLat,
                lastLng,
                location.latitude,
                location.longitude,
                result
            )

            val segment = result[0]
            if (segment in 1f..5000f) {
                distance += segment
            }
        }

        val batteryManager =
            getSystemService(BATTERY_SERVICE) as BatteryManager

        prefs.edit()
            .putInt("shift_points", points + 1)
            .putFloat("shift_distance_m", distance)
            .putLong(
                "last_lat",
                java.lang.Double.doubleToRawLongBits(location.latitude)
            )
            .putLong(
                "last_lng",
                java.lang.Double.doubleToRawLongBits(location.longitude)
            )
            .putFloat("last_accuracy", location.accuracy)
            .putFloat(
                "last_speed",
                if (location.hasSpeed()) location.speed * 3.6f else 0f
            )
            .putInt(
                "last_battery",
                batteryManager.getIntProperty(
                    BatteryManager.BATTERY_PROPERTY_CAPACITY
                )
            )
            .apply()
    }

    private fun locationPayload(location: Location): JSONObject {
        val batteryManager =
            getSystemService(BATTERY_SERVICE) as BatteryManager

        return JSONObject().apply {
            put("lat", location.latitude)
            put("lng", location.longitude)
            put("accuracy", location.accuracy.toDouble())
            put(
                "speed",
                if (location.hasSpeed()) location.speed * 3.6 else 0.0
            )
            put(
                "bearing",
                if (location.hasBearing()) location.bearing.toDouble() else 0.0
            )
            put(
                "battery",
                batteryManager.getIntProperty(
                    BatteryManager.BATTERY_PROPERTY_CAPACITY
                )
            )
            put("capturedAt", location.time)
        }
    }

    private fun flushQueue() {
        executor.execute {
            for ((id, payload) in queue.peek()) {
                if (postJson("/api/track", payload)) {
                    queue.remove(id)
                    prefs.edit()
                        .putLong("last_sent", System.currentTimeMillis())
                        .apply()
                } else {
                    break
                }
            }
        }
    }

    private fun sendShiftEvent(type: String) {
        executor.execute { sendShiftEventBlocking(type) }
    }

    private fun sendShiftEventBlocking(type: String) {
        val payload = JSONObject().apply {
            put("type", type)
            put("at", System.currentTimeMillis())
        }
        postJson("/api/shift", payload.toString())
    }

    private fun postJson(path: String, body: String): Boolean {
        val employeeId =
            prefs.getString("employee_id", "") ?: return false
        val token =
            prefs.getString("device_token", "") ?: return false

        if (employeeId.isBlank() || token.isBlank()) return false

        return try {
            val conn =
                (URL(MainActivity.BASE_URL + path).openConnection()
                    as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 8000
                    readTimeout = 8000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    setRequestProperty("User-Agent", "MXFieldTracker/1.1")
                    setRequestProperty("x-employee-id", employeeId)
                    setRequestProperty("x-device-token", token)
                }

            conn.outputStream.use {
                it.write(body.toByteArray(Charsets.UTF_8))
            }

            val ok = conn.responseCode in 200..299
            conn.disconnect()
            ok
        } catch (_: Exception) {
            false
        }
    }

    override fun onDestroy() {
        try { locationManager.removeUpdates(this) } catch (_: Exception) {}
        executor.shutdownNow()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    @Deprecated("Deprecated in Java")
    override fun onStatusChanged(
        provider: String?,
        status: Int,
        extras: Bundle?
    ) = Unit

    override fun onProviderEnabled(provider: String) = Unit
    override fun onProviderDisabled(provider: String) = Unit
}