package com.mazenmix.mxblueradar;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanFilter;
import android.bluetooth.le.ScanRecord;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class BluetoothScanService extends Service {
    public static final String ACTION_START = "com.mazenmix.mxblueradar.START";
    public static final String ACTION_STOP = "com.mazenmix.mxblueradar.STOP";
    private static final int NOTIFICATION_ID = 4101;
    private static final long LOST_AFTER_MS = 25_000L;

    private BluetoothAdapter adapter;
    private DeviceRepository repository;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Map<String, Float> smoothed = new HashMap<>();
    private final Map<String, Long> firstSeen = new HashMap<>();
    private final Map<String, Long> counts = new HashMap<>();
    private final Map<String, Long> lastPersist = new HashMap<>();
    private final Map<String, Boolean> present = new HashMap<>();
    private boolean receiverRegistered;
    private boolean scanning;

    @Override public void onCreate() {
        super.onCreate();
        repository = new DeviceRepository(this);
        BluetoothManager manager = (BluetoothManager) getSystemService(Context.BLUETOOTH_SERVICE);
        adapter = manager == null ? null : manager.getAdapter();
        createChannels();
        registerClassicReceiver();
        handler.post(presenceTick);
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopScanning();
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
            return START_NOT_STICKY;
        }
        startForeground(NOTIFICATION_ID, buildForegroundNotification());
        startScanning();
        return START_STICKY;
    }

    @Override public void onDestroy() {
        stopScanning();
        handler.removeCallbacksAndMessages(null);
        if (receiverRegistered) {
            try { unregisterReceiver(classicReceiver); } catch (Exception ignored) {}
        }
        repository.close();
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }

    private boolean hasScanPermission() {
        if (Build.VERSION.SDK_INT >= 31) return checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED;
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasConnectPermission() {
        return Build.VERSION.SDK_INT < 31 || checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
    }

    private void startScanning() {
        if (scanning) return;
        if (adapter == null) {
            ScanHub.setStatus("Bluetooth hardware unavailable");
            return;
        }
        if (!adapter.isEnabled()) {
            ScanHub.setStatus("Bluetooth is off");
            return;
        }
        if (!hasScanPermission()) {
            ScanHub.setStatus("Nearby devices permission required");
            return;
        }
        scanning = true;
        ScanHub.setScanning(true);
        ScanHub.setStatus("Scanning BLE + Classic");

        if (adapter.getBluetoothLeScanner() != null) {
            ScanSettings settings = new ScanSettings.Builder()
                    .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                    .setReportDelay(0)
                    .build();
            List<ScanFilter> matchAll = Collections.singletonList(new ScanFilter.Builder().build());
            try { adapter.getBluetoothLeScanner().startScan(matchAll, settings, bleCallback); }
            catch (SecurityException e) { ScanHub.setStatus("BLE scan permission denied"); }
        }
        try {
            if (!adapter.isDiscovering()) adapter.startDiscovery();
        } catch (SecurityException ignored) {}
    }

    private void stopScanning() {
        if (!scanning) return;
        scanning = false;
        ScanHub.setScanning(false);
        ScanHub.setStatus("Paused");
        try {
            if (adapter != null && adapter.getBluetoothLeScanner() != null && hasScanPermission())
                adapter.getBluetoothLeScanner().stopScan(bleCallback);
        } catch (Exception ignored) {}
        try {
            if (adapter != null && hasScanPermission()) adapter.cancelDiscovery();
        } catch (Exception ignored) {}
    }

    private final ScanCallback bleCallback = new ScanCallback() {
        @Override public void onScanResult(int callbackType, ScanResult result) {
            if (result != null) ingestBle(result);
        }
        @Override public void onBatchScanResults(List<ScanResult> results) {
            if (results != null) for (ScanResult r : results) ingestBle(r);
        }
        @Override public void onScanFailed(int errorCode) {
            ScanHub.setStatus("BLE scan error " + errorCode + " — Classic scan still active");
        }
    };

    private void ingestBle(ScanResult result) {
        BluetoothDevice device = result.getDevice();
        ScanRecord record = result.getScanRecord();
        String name = DeviceClassifier.safeName(device, record);
        String fp = DeviceClassifier.ghostFingerprint(record, name);
        String key = DeviceClassifier.stableKey(device, fp);
        String address = safeAddress(device);
        List<String> services = DeviceClassifier.serviceUuids(record);
        boolean mxPeer = services.contains(MxPeerManager.SERVICE_UUID.toString());
        int tx = record == null ? Integer.MIN_VALUE : record.getTxPowerLevel();
        if (tx == Integer.MIN_VALUE || tx == 127) tx = result.getTxPower();
        if (tx == 127) tx = Integer.MIN_VALUE;
        merge(key, address, name, result.getRssi(), tx, true, false, result.isConnectable(), mxPeer,
                DeviceClassifier.kind(device, name), DeviceClassifier.manufacturerSummary(record), fp, services);
    }

    private void ingestClassic(BluetoothDevice device, int rssi) {
        String name = DeviceClassifier.safeName(device, null);
        String fp = "CLASSIC-" + safeAddress(device).replace(":", "");
        String key = DeviceClassifier.stableKey(device, fp);
        DeviceRecord old = ScanHub.get(key);
        boolean wasBle = old != null && old.ble;
        merge(key, safeAddress(device), name, rssi, Integer.MIN_VALUE, wasBle, true, true,
                old != null && old.mxPeer, DeviceClassifier.kind(device, name), old == null ? "" : old.manufacturer,
                old == null ? fp : old.ghostFingerprint, old == null ? new ArrayList<>() : old.serviceUuids);
    }

    private synchronized void merge(String key, String address, String name, int rssi, int txPower,
                                    boolean ble, boolean classic, boolean connectable, boolean mxPeer,
                                    String kind, String manufacturer, String fp, List<String> services) {
        long now = System.currentTimeMillis();
        DeviceRecord old = ScanHub.get(key);
        float previous = smoothed.containsKey(key) ? smoothed.get(key) : (old == null ? rssi : old.smoothedRssi);
        float smooth = previous + 0.25f * (rssi - previous);
        smoothed.put(key, smooth);
        long first = firstSeen.containsKey(key) ? firstSeen.get(key) : (old == null ? now : old.firstSeen);
        firstSeen.put(key, first);
        long count = counts.containsKey(key) ? counts.get(key) + 1 : (old == null ? 1 : old.seenCount + 1);
        counts.put(key, count);

        if (old != null) {
            ble |= old.ble;
            classic |= old.classic;
            mxPeer |= old.mxPeer;
            if (DeviceClassifier.nameQuality(name) < DeviceClassifier.nameQuality(old.name)) name = old.name;
            if ((manufacturer == null || manufacturer.isEmpty()) && old.manufacturer != null) manufacturer = old.manufacturer;
            if ((services == null || services.isEmpty()) && old.serviceUuids != null) services = old.serviceUuids;
        }

        DeviceRecord d = new DeviceRecord(key, address, name, rssi, smooth, txPower, first, now, count,
                ble, classic, connectable, mxPeer, kind, manufacturer, fp, services);
        ScanHub.upsert(d);
        SignalStore.add(key, smooth);

        Long lp = lastPersist.get(key);
        if (lp == null || now - lp > 5_000L) {
            repository.upsert(d);
            lastPersist.put(key, now);
        }

        Boolean wasPresent = present.get(key);
        if (Boolean.FALSE.equals(wasPresent) && repository.isWatched(key)) {
            notifyWatch(d, true);
        }
        present.put(key, true);
    }

    private final Runnable presenceTick = new Runnable() {
        @Override public void run() {
            long now = System.currentTimeMillis();
            List<DeviceRecord> all = ScanHub.snapshot();
            for (DeviceRecord d : all) {
                if (now - d.lastSeen > LOST_AFTER_MS && Boolean.TRUE.equals(present.get(d.key))) {
                    present.put(d.key, false);
                    if (repository.isWatched(d.key)) notifyWatch(d, false);
                }
            }
            ScanHub.prune(120_000L);
            if (scanning && adapter != null && hasScanPermission()) {
                try {
                    if (!adapter.isDiscovering()) adapter.startDiscovery();
                } catch (Exception ignored) {}
            }
            handler.postDelayed(this, 5_000L);
        }
    };

    private void registerClassicReceiver() {
        IntentFilter f = new IntentFilter();
        f.addAction(BluetoothDevice.ACTION_FOUND);
        f.addAction(BluetoothDevice.ACTION_NAME_CHANGED);
        f.addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(classicReceiver, f, RECEIVER_NOT_EXPORTED);
        else registerReceiver(classicReceiver, f);
        receiverRegistered = true;
    }

    private final BroadcastReceiver classicReceiver = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            if (BluetoothDevice.ACTION_FOUND.equals(action)) {
                BluetoothDevice d = Build.VERSION.SDK_INT >= 33
                        ? intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice.class)
                        : intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                short rssi = intent.getShortExtra(BluetoothDevice.EXTRA_RSSI, (short) -100);
                if (d != null) ingestClassic(d, rssi);
            } else if (BluetoothDevice.ACTION_NAME_CHANGED.equals(action)) {
                BluetoothDevice d = Build.VERSION.SDK_INT >= 33
                        ? intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice.class)
                        : intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                String learned = intent.getStringExtra(BluetoothDevice.EXTRA_NAME);
                if (d != null && learned != null && !learned.trim().isEmpty()) {
                    String address = safeAddress(d);
                    for (DeviceRecord old : ScanHub.snapshot()) {
                        if (address.equals(old.address)) {
                            merge(old.key, old.address, learned.trim(), old.rssi, old.txPower,
                                    old.ble, old.classic, old.connectable, old.mxPeer,
                                    DeviceClassifier.kind(d, learned), old.manufacturer,
                                    old.ghostFingerprint, old.serviceUuids);
                            break;
                        }
                    }
                }
            } else if (BluetoothAdapter.ACTION_DISCOVERY_FINISHED.equals(action) && scanning && hasScanPermission()) {
                handler.postDelayed(() -> {
                    try { if (adapter != null && !adapter.isDiscovering()) adapter.startDiscovery(); }
                    catch (Exception ignored) {}
                }, 1_500L);
            }
        }
    };

    private String safeAddress(BluetoothDevice d) {
        if (!hasConnectPermission()) return "";
        try { return d.getAddress(); } catch (SecurityException e) { return ""; }
    }

    private void createChannels() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            nm.createNotificationChannel(new NotificationChannel("scan", "Bluetooth scan activity", NotificationManager.IMPORTANCE_LOW));
            nm.createNotificationChannel(new NotificationChannel("alerts", "Device alerts", NotificationManager.IMPORTANCE_DEFAULT));
        }
    }

    private Notification buildForegroundNotification() {
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return new Notification.Builder(this, "scan")
                .setSmallIcon(com.mazenmix.mxblueradar.R.drawable.ic_stat_bluetooth)
                .setContentTitle("MX BlueRadar")
                .setContentText("Radar scanning is active")
                .setContentIntent(pi)
                .setOngoing(true)
                .build();
    }

    private void notifyWatch(DeviceRecord d, boolean arrived) {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        String text = arrived ? "appeared nearby" : "has not been seen for 25 seconds";
        Notification n = new Notification.Builder(this, "alerts")
                .setSmallIcon(com.mazenmix.mxblueradar.R.drawable.ic_stat_bluetooth)
                .setContentTitle(d.name)
                .setContentText(text + " • " + d.proximityLabel())
                .setAutoCancel(true)
                .build();
        NotificationManager nm = getSystemService(NotificationManager.class);
        nm.notify(Math.abs(d.key.hashCode()), n);
    }
}
