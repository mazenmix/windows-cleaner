package com.mazenmix.mxfieldtracker

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.view.animation.AlphaAnimation
import android.view.animation.Animation
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import java.util.concurrent.Executors

class MainActivity : Activity() {

    companion object {
        const val BASE_URL = "https://mxtracker-5xy.pages.dev"
        private const val PERMISSION_REQUEST = 5001
    }

    private lateinit var prefs: android.content.SharedPreferences
    private lateinit var employeeName: EditText
    private lateinit var employeeCode: TextView
    private lateinit var startButton: Button
    private lateinit var stopButton: Button
    private lateinit var fixSettingsButton: Button
    private lateinit var appSettingsButton: Button
    private lateinit var statusTitle: TextView
    private lateinit var statusDetail: TextView
    private lateinit var topState: TextView
    private lateinit var lastSent: TextView
    private lateinit var shiftMetrics: TextView
    private lateinit var summaryText: TextView
    private lateinit var readinessCard: LinearLayout
    private lateinit var readinessTitle: TextView
    private lateinit var locationState: TextView
    private lateinit var backgroundState: TextView
    private lateinit var gpsState: TextView
    private lateinit var notificationState: TextView
    private lateinit var batteryState: TextView
    private lateinit var updateButton: Button
    private lateinit var updateState: TextView

    private val executor = Executors.newSingleThreadExecutor()
    private var pendingStart = false
    private var pendingInstallAfterPermission = false
    private var availableUpdate: UpdateInfo? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        prefs = getSharedPreferences("mx_tracker", MODE_PRIVATE)

        employeeName = findViewById(R.id.employeeName)
        employeeCode = findViewById(R.id.employeeCode)
        startButton = findViewById(R.id.startButton)
        stopButton = findViewById(R.id.stopButton)
        fixSettingsButton = findViewById(R.id.fixSettingsButton)
        appSettingsButton = findViewById(R.id.appSettingsButton)
        statusTitle = findViewById(R.id.statusTitle)
        statusDetail = findViewById(R.id.statusDetail)
        topState = findViewById(R.id.topState)
        lastSent = findViewById(R.id.lastSent)
        shiftMetrics = findViewById(R.id.shiftMetrics)
        summaryText = findViewById(R.id.summaryText)
        readinessCard = findViewById(R.id.readinessCard)
        readinessTitle = findViewById(R.id.readinessTitle)
        locationState = findViewById(R.id.locationState)
        backgroundState = findViewById(R.id.backgroundState)
        gpsState = findViewById(R.id.gpsState)
        notificationState = findViewById(R.id.notificationState)
        batteryState = findViewById(R.id.batteryState)
        updateButton = findViewById(R.id.updateButton)
        updateState = findViewById(R.id.updateState)
        updateState.text = "App version " + BuildConfig.VERSION_NAME + " • Checking updates…"

        ensureInstallId()
        employeeName.setText(prefs.getString("name", ""))

        startButton.setOnClickListener { beginStartFlow() }
        stopButton.setOnClickListener { stopShift() }
        fixSettingsButton.setOnClickListener { fixNextReadinessIssue() }
        appSettingsButton.setOnClickListener { openAppSettings() }
        updateButton.setOnClickListener { handleUpdateButton() }

        refreshState()
        updateReadiness()
        checkForUpdates(silent = true)
    }

    override fun onResume() {
        super.onResume()
        refreshState()
        updateReadiness()

        if (pendingInstallAfterPermission &&
            UpdateManager.canInstallPackages(this)
        ) {
            pendingInstallAfterPermission = false
            availableUpdate?.let { downloadUpdate(it) }
        }
    }

    override fun onDestroy() {
        executor.shutdownNow()
        super.onDestroy()
    }

    private fun checkForUpdates(silent: Boolean) {
        if (!silent) {
            updateButton.isEnabled = false
            updateButton.text = "CHECKING..."
            updateState.text = "Checking MX update server…"
        }

        UpdateManager.check(this) { info, error ->
            runOnUiThread {
                if (error != null || info == null) {
                    updateButton.isEnabled = true
                    updateButton.text = "CHECK FOR UPDATE"
                    updateState.text =
                        "Version " + BuildConfig.VERSION_NAME +
                            " • Could not check right now"
                    if (!silent) {
                        Toast.makeText(
                            this,
                            "Could not check for updates.",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                    return@runOnUiThread
                }

                if (UpdateManager.isNewer(info)) {
                    availableUpdate = info
                    updateButton.isEnabled = true
                    updateButton.text =
                        "UPDATE AVAILABLE • v" + info.versionName
                    updateButton.setTextColor(Color.parseColor("#FFD35A"))
                    updateState.text =
                        "New version " + info.versionName +
                            " is ready • Tap to download and install"
                    updateState.setTextColor(Color.parseColor("#FFD35A"))
                    UpdateManager.showUpdateAvailableNotification(this, info)
                } else {
                    availableUpdate = null
                    updateButton.isEnabled = true
                    updateButton.text = "CHECK FOR UPDATE"
                    updateButton.setTextColor(Color.parseColor("#F5F7FA"))
                    updateState.text =
                        "Version " + BuildConfig.VERSION_NAME +
                            " • You are up to date"
                    updateState.setTextColor(Color.parseColor("#39F08C"))
                }
            }
        }
    }

    private fun handleUpdateButton() {
        val info = availableUpdate
        if (info == null) {
            checkForUpdates(silent = false)
            return
        }

        if (!UpdateManager.canInstallPackages(this)) {
            pendingInstallAfterPermission = true
            Toast.makeText(
                this,
                "Allow MX Field Tracker to install updates, then return.",
                Toast.LENGTH_LONG
            ).show()
            UpdateManager.openInstallPermission(this)
            return
        }

        downloadUpdate(info)
    }

    private fun downloadUpdate(info: UpdateInfo) {
        updateButton.isEnabled = false
        updateState.setTextColor(Color.parseColor("#59A8FF"))
        updateState.text = "Preparing update…"

        UpdateManager.downloadAndInstall(
            this,
            info,
            onProgress = { pct ->
                runOnUiThread {
                    updateButton.text = "DOWNLOADING • " + pct + "%"
                    updateState.text =
                        "Downloading MX Field Tracker v" +
                            info.versionName + "…"
                }
            },
            onError = { error ->
                runOnUiThread {
                    updateButton.isEnabled = true
                    updateButton.text =
                        "UPDATE AVAILABLE • v" + info.versionName
                    updateState.setTextColor(Color.parseColor("#FF6673"))
                    updateState.text =
                        "Update download failed • Tap to retry"
                    Toast.makeText(
                        this,
                        error.message ?: "Update failed",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        )
    }

    private fun ensureInstallId(): String {
        var id = prefs.getString("install_id", null)
        if (id.isNullOrBlank()) {
            id = UUID.randomUUID().toString()
            prefs.edit().putString("install_id", id).apply()
        }
        return id
    }

    private fun hasFineLocation(): Boolean =
        checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED

    private fun hasBackgroundLocation(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
            checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED

    private fun notificationsReady(): Boolean =
        Build.VERSION.SDK_INT < 33 ||
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    private fun gpsReady(): Boolean {
        val lm = getSystemService(LOCATION_SERVICE) as LocationManager
        return try {
            lm.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
        } catch (_: Exception) {
            false
        }
    }

    private fun batteryReady(): Boolean {
        val pm = getSystemService(POWER_SERVICE) as PowerManager
        return try {
            pm.isIgnoringBatteryOptimizations(packageName)
        } catch (_: Exception) {
            false
        }
    }

    private fun criticalReady(): Boolean =
        hasFineLocation() && hasBackgroundLocation() && notificationsReady() && gpsReady()

    private fun updateReadiness() {
        val fine = hasFineLocation()
        val background = hasBackgroundLocation()
        val gps = gpsReady()
        val notifications = notificationsReady()
        val battery = batteryReady()
        val all = fine && background && gps && notifications && battery

        locationState.text = if (fine) "✓ Precise location permission — Ready" else "✕ Precise location permission — Required"
        backgroundState.text = if (background) "✓ Background / always-on location — Ready" else "⚠ Background / always-on location — Action needed"
        gpsState.text = if (gps) "✓ GPS / Location service — ON" else "✕ GPS / Location service — OFF"
        notificationState.text = if (notifications) "✓ Tracking notification — Ready" else "✕ Tracking notification — Required"
        batteryState.text = if (battery) "✓ Battery optimization — Unrestricted" else "⚠ Battery optimization — Set to unrestricted"

        locationState.setTextColor(Color.parseColor(if (fine) "#39F08C" else "#FF6673"))
        backgroundState.setTextColor(Color.parseColor(if (background) "#39F08C" else "#FFD35A"))
        gpsState.setTextColor(Color.parseColor(if (gps) "#39F08C" else "#FF6673"))
        notificationState.setTextColor(Color.parseColor(if (notifications) "#39F08C" else "#FF6673"))
        batteryState.setTextColor(Color.parseColor(if (battery) "#39F08C" else "#FFD35A"))

        if (all) {
            readinessTitle.text = "✓ TRACKING READINESS — READY"
            readinessTitle.setTextColor(Color.parseColor("#39F08C"))
            readinessCard.clearAnimation()
        } else {
            readinessTitle.text = "⚠ TRACKING READINESS — ACTION NEEDED"
            readinessTitle.setTextColor(Color.parseColor("#FFD35A"))
            val pulse = AlphaAnimation(0.58f, 1.0f).apply {
                duration = 800
                repeatMode = Animation.REVERSE
                repeatCount = Animation.INFINITE
            }
            readinessCard.startAnimation(pulse)
        }
    }

    private fun beginStartFlow() {
        val name = employeeName.text.toString().trim().replace(Regex("\\s+"), " ")
        if (name.length < 2) {
            Toast.makeText(this, "Enter your full name first.", Toast.LENGTH_SHORT).show()
            return
        }

        val savedName = prefs.getString("name", "") ?: ""
        val token = prefs.getString("device_token", "") ?: ""
        val employeeId = prefs.getString("employee_id", "") ?: ""

        pendingStart = true

        if (token.isBlank() || employeeId.isBlank() || savedName != name) {
            registerDevice(name)
        } else {
            continueStartAfterRegistration()
        }
    }

    private fun continueStartAfterRegistration() {
        updateReadiness()

        if (!criticalReady()) {
            pendingStart = true
            Toast.makeText(
                this,
                "Complete the required tracking settings first.",
                Toast.LENGTH_LONG
            ).show()
            fixNextReadinessIssue()
            return
        }

        if (!batteryReady()) {
            Toast.makeText(
                this,
                "Set battery usage to Unrestricted for reliable background tracking.",
                Toast.LENGTH_LONG
            ).show()
            openBatterySettings()
            return
        }

        launchTracker()
    }

    private fun registerDevice(name: String) {
        startButton.isEnabled = false
        statusTitle.text = "● CONNECTING"
        statusTitle.setTextColor(Color.parseColor("#59A8FF"))
        statusDetail.text = "Registering this work phone with MX Field Tracker…"

        executor.execute {
            try {
                val payload = JSONObject().apply {
                    put("name", name)
                    put("installId", ensureInstallId())
                    put("device", Build.MANUFACTURER + " " + Build.MODEL)
                    put("android", Build.VERSION.RELEASE)
                }

                val conn = (URL(BASE_URL + "/api/register").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 10000
                    readTimeout = 10000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    setRequestProperty("User-Agent", "MXFieldTracker/" + BuildConfig.VERSION_NAME)
                }

                conn.outputStream.use {
                    it.write(payload.toString().toByteArray(Charsets.UTF_8))
                }

                val code = conn.responseCode
                val responseText = try {
                    val stream = if (code in 200..299) conn.inputStream else conn.errorStream
                    stream?.bufferedReader()?.use { it.readText() }.orEmpty()
                } finally {
                    conn.disconnect()
                }

                if (code !in 200..299) {
                    throw IllegalStateException(
                        JSONObject(responseText.ifBlank { "{}" })
                            .optString("error", "Registration failed")
                    )
                }

                val data = JSONObject(responseText)
                val employeeId = data.getString("employeeId")
                val token = data.getString("deviceToken")

                prefs.edit()
                    .putString("name", name)
                    .putString("employee_id", employeeId)
                    .putString("device_token", token)
                    .apply()

                runOnUiThread {
                    employeeCode.text = "Registered • " + employeeId
                    continueStartAfterRegistration()
                }
            } catch (e: Exception) {
                runOnUiThread {
                    pendingStart = false
                    startButton.isEnabled = true
                    statusTitle.text = "● OFF SHIFT"
                    statusTitle.setTextColor(Color.parseColor("#8E9AAA"))
                    statusDetail.text = "Could not connect to MX Field Tracker."
                    Toast.makeText(
                        this,
                        e.message ?: "Registration failed",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        }
    }

    private fun fixNextReadinessIssue() {
        if (!hasFineLocation()) {
            requestPermissions(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                ),
                PERMISSION_REQUEST
            )
            return
        }

        if (!hasBackgroundLocation()) {
            if (Build.VERSION.SDK_INT == Build.VERSION_CODES.Q) {
                requestPermissions(
                    arrayOf(Manifest.permission.ACCESS_BACKGROUND_LOCATION),
                    PERMISSION_REQUEST
                )
            } else {
                Toast.makeText(
                    this,
                    "Open Permissions → Location → choose Allow all the time.",
                    Toast.LENGTH_LONG
                ).show()
                openAppSettings()
            }
            return
        }

        if (!notificationsReady()) {
            if (Build.VERSION.SDK_INT >= 33) {
                requestPermissions(
                    arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                    PERMISSION_REQUEST
                )
            }
            return
        }

        if (!gpsReady()) {
            startActivity(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS))
            return
        }

        if (!batteryReady()) {
            openBatterySettings()
            return
        }

        Toast.makeText(this, "Tracking readiness is complete.", Toast.LENGTH_SHORT).show()
    }

    private fun openBatterySettings() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val request = Intent(
                    Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                    Uri.parse("package:" + packageName)
                )
                startActivity(request)
            } else {
                openAppSettings()
            }
        } catch (_: Exception) {
            try {
                startActivity(
                    Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
                )
            } catch (_: Exception) {
                openAppSettings()
            }
        }
    }

    private fun openAppSettings() {
        val intent = Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.parse("package:" + packageName)
        )
        startActivity(intent)
    }

    private fun launchTracker() {
        pendingStart = false
        val now = System.currentTimeMillis()

        prefs.edit()
            .putBoolean("tracking", true)
            .putLong("shift_start", now)
            .putInt("shift_points", 0)
            .putFloat("shift_distance_m", 0f)
            .remove("last_lat")
            .remove("last_lng")
            .apply()

        val intent = Intent(this, TrackerService::class.java)
            .setAction(TrackerService.ACTION_START)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }

        refreshState()
        Toast.makeText(this, "Shift started • live tracking active", Toast.LENGTH_SHORT).show()
    }

    private fun stopShift() {
        val start = prefs.getLong("shift_start", 0L)
        val points = prefs.getInt("shift_points", 0)
        val distanceM = prefs.getFloat("shift_distance_m", 0f)
        val duration = if (start > 0) System.currentTimeMillis() - start else 0L

        val summary = "Last shift • " + formatDuration(duration) +
            " • " + points + " locations • " +
            String.format("%.2f km", distanceM / 1000f)

        prefs.edit()
            .putBoolean("tracking", false)
            .putString("last_summary", summary)
            .apply()

        startService(
            Intent(this, TrackerService::class.java)
                .setAction(TrackerService.ACTION_STOP)
        )

        refreshState()
        Toast.makeText(this, "Shift ended", Toast.LENGTH_SHORT).show()
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != PERMISSION_REQUEST) return

        updateReadiness()

        if (pendingStart) {
            if (criticalReady() && batteryReady()) {
                launchTracker()
            } else {
                fixNextReadinessIssue()
            }
        }
    }

    private fun formatDuration(ms: Long): String {
        if (ms <= 0) return "—"
        val totalMin = ms / 60000
        val hours = totalMin / 60
        val mins = totalMin % 60
        return if (hours > 0) {
            hours.toString() + "h " + mins.toString() + "m"
        } else {
            mins.toString() + "m"
        }
    }

    private fun refreshState() {
        val tracking = prefs.getBoolean("tracking", false)
        val id = prefs.getString("employee_id", "") ?: ""

        employeeCode.text =
            if (id.isBlank()) "Device not registered yet"
            else "Registered • " + id

        employeeName.isEnabled = !tracking
        startButton.isEnabled = !tracking
        stopButton.isEnabled = tracking

        if (tracking) {
            topState.text = "LIVE"
            topState.setTextColor(Color.parseColor("#39F08C"))
            statusTitle.text = "● TRACKING ACTIVE"
            statusTitle.setTextColor(Color.parseColor("#39F08C"))
            statusDetail.text =
                "Your work location is being sent securely in the background."
        } else {
            topState.text = "OFF SHIFT"
            topState.setTextColor(Color.parseColor("#8E9AAA"))
            statusTitle.text = "● OFF SHIFT"
            statusTitle.setTextColor(Color.parseColor("#8E9AAA"))
            statusDetail.text =
                "Enter your name, complete the readiness check, then start your shift."
        }

        val sent = prefs.getLong("last_sent", 0L)
        lastSent.text =
            if (sent == 0L) "Last location upload: —"
            else "Last location upload: " +
                java.text.DateFormat.getTimeInstance()
                    .format(java.util.Date(sent))

        val shiftStart = prefs.getLong("shift_start", 0L)
        val points = prefs.getInt("shift_points", 0)
        val distanceM = prefs.getFloat("shift_distance_m", 0f)
        val duration = if (tracking && shiftStart > 0) {
            System.currentTimeMillis() - shiftStart
        } else {
            0L
        }

        shiftMetrics.text =
            "Shift time " + formatDuration(duration) +
                "   •   Locations " + points +
                "   •   " + String.format("Distance %.2f km", distanceM / 1000f)

        summaryText.text = prefs.getString(
            "last_summary",
            "Latest shift summary will appear here after End Shift."
        )
    }
}