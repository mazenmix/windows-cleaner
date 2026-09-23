package com.mazenmix.mxfieldtracker

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
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
    private lateinit var statusTitle: TextView
    private lateinit var statusDetail: TextView
    private lateinit var lastSent: TextView
    private val executor = Executors.newSingleThreadExecutor()
    private var pendingStart = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        prefs = getSharedPreferences("mx_tracker", MODE_PRIVATE)
        employeeName = findViewById(R.id.employeeName)
        employeeCode = findViewById(R.id.employeeCode)
        startButton = findViewById(R.id.startButton)
        stopButton = findViewById(R.id.stopButton)
        statusTitle = findViewById(R.id.statusTitle)
        statusDetail = findViewById(R.id.statusDetail)
        lastSent = findViewById(R.id.lastSent)

        ensureInstallId()
        employeeName.setText(prefs.getString("name", ""))

        startButton.setOnClickListener { beginStartFlow() }
        stopButton.setOnClickListener { stopShift() }

        refreshState()
    }

    override fun onResume() {
        super.onResume()
        refreshState()
    }

    override fun onDestroy() {
        executor.shutdownNow()
        super.onDestroy()
    }

    private fun ensureInstallId(): String {
        var id = prefs.getString("install_id", null)
        if (id.isNullOrBlank()) {
            id = UUID.randomUUID().toString()
            prefs.edit().putString("install_id", id).apply()
        }
        return id
    }

    private fun beginStartFlow() {
        val name = employeeName.text.toString().trim().replace(Regex("\\s+"), " ")
        if (name.length < 2) {
            Toast.makeText(this, "Enter your name first.", Toast.LENGTH_SHORT).show()
            return
        }

        val savedName = prefs.getString("name", "") ?: ""
        val token = prefs.getString("device_token", "") ?: ""
        val employeeId = prefs.getString("employee_id", "") ?: ""

        if (token.isBlank() || employeeId.isBlank() || savedName != name) {
            registerDevice(name)
        } else {
            requestPermissionsThenStart()
        }
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

                val conn = (URL("$BASE_URL/api/register").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 10000
                    readTimeout = 10000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    setRequestProperty("User-Agent", "MXFieldTracker/1.0")
                }

                conn.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
                val code = conn.responseCode
                val text = try {
                    val stream = if (code in 200..299) conn.inputStream else conn.errorStream
                    stream?.bufferedReader()?.use { it.readText() }.orEmpty()
                } finally {
                    conn.disconnect()
                }

                if (code !in 200..299) {
                    throw IllegalStateException(JSONObject(text.ifBlank { "{}" }).optString("error", "Registration failed"))
                }

                val data = JSONObject(text)
                val employeeId = data.getString("employeeId")
                val token = data.getString("deviceToken")

                prefs.edit()
                    .putString("name", name)
                    .putString("employee_id", employeeId)
                    .putString("device_token", token)
                    .apply()

                runOnUiThread {
                    employeeCode.text = "Registered • $employeeId"
                    requestPermissionsThenStart()
                }
            } catch (e: Exception) {
                runOnUiThread {
                    startButton.isEnabled = true
                    statusTitle.text = "● OFF SHIFT"
                    statusTitle.setTextColor(Color.parseColor("#8E9AAA"))
                    statusDetail.text = "Could not connect to MX Field Tracker."
                    Toast.makeText(this, e.message ?: "Registration failed", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun requestPermissionsThenStart() {
        val missing = mutableListOf<String>()
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            missing += Manifest.permission.ACCESS_FINE_LOCATION
        }
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            missing += Manifest.permission.POST_NOTIFICATIONS
        }

        if (missing.isNotEmpty()) {
            pendingStart = true
            requestPermissions(missing.toTypedArray(), PERMISSION_REQUEST)
        } else {
            launchTracker()
        }
    }

    private fun launchTracker() {
        pendingStart = false
        prefs.edit().putBoolean("tracking", true).apply()
        val intent = Intent(this, TrackerService::class.java).setAction(TrackerService.ACTION_START)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
        refreshState()
        Toast.makeText(this, "Shift started • live location active", Toast.LENGTH_SHORT).show()
    }

    private fun stopShift() {
        prefs.edit().putBoolean("tracking", false).apply()
        startService(Intent(this, TrackerService::class.java).setAction(TrackerService.ACTION_STOP))
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

        val locationGranted =
            checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED

        if (pendingStart && locationGranted) {
            launchTracker()
        } else if (!locationGranted) {
            pendingStart = false
            Toast.makeText(
                this,
                "Location permission is required while your work shift is active.",
                Toast.LENGTH_LONG
            ).show()
            refreshState()
        }
    }

    private fun refreshState() {
        val tracking = prefs.getBoolean("tracking", false)
        val id = prefs.getString("employee_id", "") ?: ""

        employeeCode.text = if (id.isBlank()) "Device not registered yet" else "Registered • $id"
        employeeName.isEnabled = !tracking
        startButton.isEnabled = !tracking
        stopButton.isEnabled = tracking

        if (tracking) {
            statusTitle.text = "● LIVE SHIFT"
            statusTitle.setTextColor(Color.parseColor("#39F08C"))
            statusDetail.text = "Your live work location is being shared with the company dashboard."
        } else {
            statusTitle.text = "● OFF SHIFT"
            statusTitle.setTextColor(Color.parseColor("#8E9AAA"))
            statusDetail.text = "Enter your name and start your work shift."
        }

        val sent = prefs.getLong("last_sent", 0L)
        lastSent.text = if (sent == 0L) {
            "Last location upload: —"
        } else {
            "Last location upload: " +
                java.text.DateFormat.getTimeInstance().format(java.util.Date(sent))
        }
    }
}