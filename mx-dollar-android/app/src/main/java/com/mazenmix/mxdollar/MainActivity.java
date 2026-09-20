package com.mazenmix.mxdollar;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.text.Html;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ScrollView;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.text.DecimalFormat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MainActivity extends Activity {
    private static final String UPDATE_URL =
            "https://raw.githubusercontent.com/mazenmix/windows-cleaner/main/mx-dollar-android/update-android.json";

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());

    private DollarView dollarView;
    private MarketData data = new MarketData();
    private UpdateInfo updateInfo = new UpdateInfo();
    private boolean refreshing = false;
    private boolean checkingUpdate = false;
    private boolean downloadingUpdate = false;
    private long downloadId = -1;
    private Uri pendingInstallUri;
    private BroadcastReceiver downloadReceiver;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(Color.rgb(10, 14, 20));
        getWindow().setNavigationBarColor(Color.rgb(10, 14, 20));

        if (Build.VERSION.SDK_INT >= 33 &&
                checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 41);
        }

        loadCache();
        createNotificationChannel();

        dollarView = new DollarView(this);
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(Color.rgb(10, 14, 20));
        scroll.addView(dollarView, new ScrollView.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT));
        setContentView(scroll);

        registerDownloadReceiver();
        refreshMarkets(false);
        checkForUpdate();

        main.postDelayed(autoRefresh, 60_000);
        main.postDelayed(autoUpdateCheck, 3_600_000);
    }

    private final Runnable autoRefresh = new Runnable() {
        @Override public void run() {
            refreshMarkets(false);
            main.postDelayed(this, 60_000);
        }
    };

    private final Runnable autoUpdateCheck = new Runnable() {
        @Override public void run() {
            checkForUpdate();
            main.postDelayed(this, 3_600_000);
        }
    };

    @Override
    protected void onResume() {
        super.onResume();
        if (pendingInstallUri != null &&
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
                getPackageManager().canRequestPackageInstalls()) {
            Uri uri = pendingInstallUri;
            pendingInstallUri = null;
            openInstaller(uri);
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        main.removeCallbacksAndMessages(null);
        executor.shutdownNow();
        if (downloadReceiver != null) {
            try { unregisterReceiver(downloadReceiver); } catch (Exception ignored) {}
        }
    }

    private void registerDownloadReceiver() {
        downloadReceiver = new BroadcastReceiver() {
            @Override public void onReceive(Context context, Intent intent) {
                if (!DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction())) return;
                long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                if (id != downloadId) return;
                verifyAndInstallDownloadedApk();
            }
        };

        IntentFilter f = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        if (Build.VERSION.SDK_INT >= 33) {
            registerReceiver(downloadReceiver, f, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(downloadReceiver, f);
        }
    }

    private void refreshMarkets(boolean manual) {
        if (refreshing) return;
        refreshing = true;
        dollarView.invalidate();

        final int oldHigh = data.highSell();

        executor.execute(() -> {
            MarketData fresh = new MarketData();
            String error = null;
            try {
                String dollarHtml = fetchText("https://t.me/s/dollariraqi");
                parseDollar(dollarHtml, fresh);

                String goldHtml = fetchText("https://mithqaly.com/%D8%A7%D8%B3%D8%B9%D8%A7%D8%B1-%D8%A7%D9%84%D8%B0%D9%87%D8%A8/");
                parseGold(goldHtml, fresh);

                fresh.updatedAt = System.currentTimeMillis();
                if (fresh.highSell() <= 0 && fresh.gold21 <= 0) {
                    throw new IllegalStateException("No market data");
                }
            } catch (Exception e) {
                error = e.getMessage();
            }

            final String finalError = error;
            main.post(() -> {
                if (finalError == null) {
                    data = fresh;
                    saveCache();
                    int newHigh = data.highSell();
                    if (oldHigh > 0 && newHigh > 0 && oldHigh != newHigh) {
                        showPriceNotification(oldHigh, newHigh);
                    } else if (manual) {
                        Toast.makeText(this, "تم تحديث الأسعار", Toast.LENGTH_SHORT).show();
                    }
                } else if (manual) {
                    Toast.makeText(this, "تعذر تحديث الأسعار حالياً", Toast.LENGTH_SHORT).show();
                }
                refreshing = false;
                dollarView.invalidate();
            });
        });
    }

    private void checkForUpdate() {
        if (checkingUpdate || downloadingUpdate) return;
        checkingUpdate = true;
        updateInfo.status = "جاري فحص التحديث...";
        dollarView.invalidate();

        executor.execute(() -> {
            try {
                String json = fetchText(UPDATE_URL + "?t=" + System.currentTimeMillis());
                JSONObject o = new JSONObject(json);
                UpdateInfo u = new UpdateInfo();
                u.version = o.optString("version", "");
                u.url = o.optString("url", "");
                u.sha256 = o.optString("sha256", "");
                u.notes = o.optString("notes", "");

                String current = currentVersion();
                u.available = compareVersions(u.version, current) > 0;
                u.status = u.available ? "Update Available · v" + u.version : "التطبيق محدّث";

                main.post(() -> {
                    updateInfo = u;
                    checkingUpdate = false;
                    dollarView.invalidate();
                });
            } catch (Exception e) {
                main.post(() -> {
                    checkingUpdate = false;
                    updateInfo.available = false;
                    updateInfo.status = "تعذر فحص التحديث";
                    dollarView.invalidate();
                });
            }
        });
    }

    private void downloadUpdate() {
        if (!updateInfo.available || downloadingUpdate || updateInfo.url.isEmpty()) return;

        try {
            DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
            DownloadManager.Request req = new DownloadManager.Request(Uri.parse(updateInfo.url));
            req.setTitle("MX Dollar v" + updateInfo.version);
            req.setDescription("Downloading update...");
            req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            req.setMimeType("application/vnd.android.package-archive");
            req.setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, "MX.Dollar.update.apk");
            downloadId = dm.enqueue(req);
            downloadingUpdate = true;
            updateInfo.status = "جاري تنزيل التحديث...";
            dollarView.invalidate();
        } catch (Exception e) {
            Toast.makeText(this, "فشل بدء تنزيل التحديث", Toast.LENGTH_LONG).show();
        }
    }

    private void verifyAndInstallDownloadedApk() {
        executor.execute(() -> {
            try {
                DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                Uri uri = dm.getUriForDownloadedFile(downloadId);
                if (uri == null) throw new IllegalStateException("Download missing");

                String actual = sha256(uri);
                if (!actual.equalsIgnoreCase(updateInfo.sha256)) {
                    throw new SecurityException("SHA-256 mismatch");
                }

                main.post(() -> {
                    downloadingUpdate = false;
                    updateInfo.status = "اكتمل التنزيل · جاهز للتثبيت";
                    dollarView.invalidate();

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
                            !getPackageManager().canRequestPackageInstalls()) {
                        pendingInstallUri = uri;
                        Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                Uri.parse("package:" + getPackageName()));
                        startActivity(settings);
                        Toast.makeText(this,
                                "فعّل السماح بتثبيت التطبيقات من MX Dollar ثم ارجع",
                                Toast.LENGTH_LONG).show();
                    } else {
                        openInstaller(uri);
                    }
                });
            } catch (Exception e) {
                main.post(() -> {
                    downloadingUpdate = false;
                    updateInfo.status = "فشل التحقق من التحديث";
                    dollarView.invalidate();
                    Toast.makeText(this, "فشل التحديث: الملف غير صالح", Toast.LENGTH_LONG).show();
                });
            }
        });
    }

    private void openInstaller(Uri uri) {
        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setDataAndType(uri, "application/vnd.android.package-archive");
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(i);
    }

    private String sha256(Uri uri) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        try (InputStream in = getContentResolver().openInputStream(uri)) {
            if (in == null) throw new IllegalStateException("Cannot read APK");
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) md.update(buf, 0, n);
        }
        StringBuilder sb = new StringBuilder();
        for (byte b : md.digest()) sb.append(String.format(Locale.US, "%02x", b));
        return sb.toString();
    }

    private String currentVersion() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "1.0.0";
        }
    }

    private static int compareVersions(String a, String b) {
        String[] aa = a.replace("v", "").split("\\.");
        String[] bb = b.replace("v", "").split("\\.");
        int n = Math.max(aa.length, bb.length);
        for (int i = 0; i < n; i++) {
            int x = i < aa.length ? safeInt(aa[i]) : 0;
            int y = i < bb.length ? safeInt(bb[i]) : 0;
            if (x != y) return Integer.compare(x, y);
        }
        return 0;
    }

    private static int safeInt(String s) {
        try {
            Matcher m = Pattern.compile("^\\d+").matcher(s);
            return m.find() ? Integer.parseInt(m.group()) : 0;
        } catch (Exception e) {
            return 0;
        }
    }

    private String fetchText(String address) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(address).openConnection();
        c.setConnectTimeout(12_000);
        c.setReadTimeout(15_000);
        c.setRequestProperty("User-Agent", "MX-Dollar-Android/" + currentVersion());
        c.setRequestProperty("Accept-Language", "ar-IQ,ar;q=0.9,en;q=0.8");
        c.setUseCaches(false);

        int code = c.getResponseCode();
        if (code < 200 || code >= 300) throw new IllegalStateException("HTTP " + code);

        StringBuilder sb = new StringBuilder();
        try (BufferedReader br = new BufferedReader(new InputStreamReader(c.getInputStream()))) {
            String line;
            while ((line = br.readLine()) != null) sb.append(line).append('\n');
        } finally {
            c.disconnect();
        }
        return sb.toString();
    }

    private static String plainText(String html) {
        String s = html.replaceAll("(?is)<script.*?</script>|<style.*?</style>", " ");
        s = s.replaceAll("(?s)<[^>]*>", "\n");
        s = Html.fromHtml(s, Html.FROM_HTML_MODE_LEGACY).toString();
        return s.replace('\u200f', ' ').replace('\u200e', ' ').replaceAll("\\s+", " ");
    }

    private static void parseDollar(String html, MarketData out) {
        String txt = plainText(html);
        parseMarket(txt, "كفاح", true, out);
        parseMarket(txt, "حارثية", false, out);
    }

    private static void parseMarket(String txt, String name, boolean kifah, MarketData out) {
        Pattern p = Pattern.compile(name + "\\s*([0-9]{4}\\.[0-9]{2})\\s*\\|\\s*([0-9]{4}\\.[0-9]{2})");
        Matcher m = p.matcher(txt);
        double buy = 0, sell = 0;
        while (m.find()) {
            buy = Double.parseDouble(m.group(1));
            sell = Double.parseDouble(m.group(2));
        }
        int b = (int) Math.round(buy * 100.0);
        int s = (int) Math.round(sell * 100.0);
        if (kifah) {
            out.kifahBuy = b;
            out.kifahSell = s;
        } else {
            out.harithiyaBuy = b;
            out.harithiyaSell = s;
        }
    }

    private static void parseGold(String html, MarketData out) {
        String txt = plainText(html);
        out.gold21 = parseGoldK(txt, "21");
        out.gold24 = parseGoldK(txt, "24");
        if (out.gold24 > 0) {
            out.gold18 = (int) Math.round(out.gold24 * 0.75);
        } else if (out.gold21 > 0) {
            out.gold18 = (int) Math.round(out.gold21 * (18.0 / 21.0));
            out.gold24 = (int) Math.round(out.gold21 * (24.0 / 21.0));
        }
    }

    private static int parseGoldK(String txt, String k) {
        Pattern p = Pattern.compile("مثقال ذهب عيار\\s*" + k +
                "[^0-9]{0,80}([0-9]{2,3}(?:,[0-9]{3}){1,2})\\s*د\\.ع");
        Matcher m = p.matcher(txt);
        if (!m.find()) return 0;
        return Integer.parseInt(m.group(1).replace(",", ""));
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            NotificationChannel c = new NotificationChannel(
                    "mx_price_changes", "MX Dollar Price Changes", NotificationManager.IMPORTANCE_DEFAULT);
            c.setDescription("USD/IQD price change alerts");
            nm.createNotificationChannel(c);
        }
    }

    private void showPriceNotification(int oldPrice, int newPrice) {
        if (Build.VERSION.SDK_INT >= 33 &&
                checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return;
        }

        String arrow = newPrice > oldPrice ? "▲" : "▼";
        android.app.Notification.Builder b = Build.VERSION.SDK_INT >= 26
                ? new android.app.Notification.Builder(this, "mx_price_changes")
                : new android.app.Notification.Builder(this);

        b.setSmallIcon(android.R.drawable.stat_notify_sync)
                .setContentTitle("MX Dollar " + arrow)
                .setContentText("أعلى سعر الآن " + formatIQD(newPrice) + " د.ع لكل 100$")
                .setAutoCancel(true);

        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        nm.notify(102, b.build());
    }

    private void loadCache() {
        SharedPreferences p = getSharedPreferences("mx_cache", MODE_PRIVATE);
        data.kifahBuy = p.getInt("kb", 0);
        data.kifahSell = p.getInt("ks", 0);
        data.harithiyaBuy = p.getInt("hb", 0);
        data.harithiyaSell = p.getInt("hs", 0);
        data.gold18 = p.getInt("g18", 0);
        data.gold21 = p.getInt("g21", 0);
        data.gold24 = p.getInt("g24", 0);
        data.updatedAt = p.getLong("updated", 0);
    }

    private void saveCache() {
        getSharedPreferences("mx_cache", MODE_PRIVATE).edit()
                .putInt("kb", data.kifahBuy)
                .putInt("ks", data.kifahSell)
                .putInt("hb", data.harithiyaBuy)
                .putInt("hs", data.harithiyaSell)
                .putInt("g18", data.gold18)
                .putInt("g21", data.gold21)
                .putInt("g24", data.gold24)
                .putLong("updated", data.updatedAt)
                .apply();
    }

    private static String formatIQD(int n) {
        if (n <= 0) return "—";
        return new DecimalFormat("#,###").format(n);
    }

    private static class MarketData {
        int kifahBuy, kifahSell, harithiyaBuy, harithiyaSell;
        int gold18, gold21, gold24;
        long updatedAt;

        int highSell() { return Math.max(kifahSell, harithiyaSell); }
        int highBuy() { return Math.max(kifahBuy, harithiyaBuy); }
    }

    private static class UpdateInfo {
        String version = "";
        String url = "";
        String sha256 = "";
        String notes = "";
        String status = "جاري فحص التحديث...";
        boolean available = false;
    }

    private final class DollarView extends View {
        private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final RectF refreshRect = new RectF(276, 608, 400, 654);
        private final RectF updateRect = new RectF(275, 704, 400, 748);

        DollarView(Context context) {
            super(context);
            p.setTypeface(Typeface.create("sans", Typeface.NORMAL));
            setLayerType(View.LAYER_TYPE_SOFTWARE, null);
        }

        @Override
        protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
            int w = MeasureSpec.getSize(widthMeasureSpec);
            if (w <= 0) w = getResources().getDisplayMetrics().widthPixels;
            float s = w / 420f;
            int h = Math.round(780 * s);
            setMeasuredDimension(w, h);
        }

        private float s() { return getWidth() / 420f; }
        private float X(float v) { return v * s(); }

        @Override
        protected void onDraw(Canvas c) {
            super.onDraw(c);
            float sc = s();
            c.drawColor(rgb(10, 14, 20));

            // Header
            rect(c, 0, 0, 420, 72, rgb(13, 18, 26), 0);
            rect(c, 0, 71, 420, 72, rgb(35, 42, 52), 0);
            round(c, 18, 16, 58, 56, 18, rgb(25, 33, 45));
            stroke(c, 18, 16, 58, 56, 18, rgb(229, 197, 118), 1);
            txt(c, "$", 38, 44, 20, rgb(229, 197, 118), Paint.Align.CENTER, true);
            txt(c, "MX DOLLAR", 70, 35, 18, Color.WHITE, Paint.Align.LEFT, true);
            txt(c, "IRAQ MARKET WATCH", 70, 54, 9, rgb(125, 137, 153), Paint.Align.LEFT, true);
            round(c, 322, 22, 376, 50, 14, rgb(19, 43, 35));
            dot(c, 334, 36, 4, rgb(75, 209, 151));
            txt(c, "LIVE", 346, 40, 9, rgb(103, 224, 168), Paint.Align.LEFT, true);

            // USD hero
            round(c, 18, 92, 402, 258, 24, rgb(16, 22, 31));
            stroke(c, 18, 92, 402, 258, 24, rgb(43, 52, 65), 1);
            round(c, 18, 92, 24, 258, 5, rgb(89, 181, 255));
            txt(c, "USD / IQD", 36, 122, 12, rgb(131, 192, 247), Paint.Align.LEFT, true);
            txt(c, "السعر الأعلى الآن لكل 100$", 36, 151, 11, rgb(172, 181, 193), Paint.Align.LEFT, true);
            txt(c, formatIQD(data.highSell()), 36, 207, 31, rgb(248, 250, 252), Paint.Align.LEFT, true);
            txt(c, "د.ع", 226, 207, 11, rgb(136, 148, 163), Paint.Align.LEFT, true);

            round(c, 282, 120, 382, 168, 15, rgb(18, 37, 31));
            txt(c, "شراء", 294, 141, 10, rgb(103, 224, 168), Paint.Align.LEFT, true);
            txt(c, formatIQD(data.highBuy()), 370, 147, 14, rgb(230, 238, 234), Paint.Align.RIGHT, true);

            round(c, 282, 182, 382, 230, 15, rgb(42, 31, 25));
            txt(c, "بيع", 294, 203, 10, rgb(241, 180, 111), Paint.Align.LEFT, true);
            txt(c, formatIQD(data.highSell()), 370, 209, 14, rgb(246, 236, 224), Paint.Align.RIGHT, true);

            sourceCard(c, 18, 278, 201, 382, "بورصة الكفاح", "KIFAH", data.kifahBuy, data.kifahSell);
            sourceCard(c, 219, 278, 402, 382, "بورصة الحارثية", "HARITHIYA", data.harithiyaBuy, data.harithiyaSell);

            txt(c, "GOLD · الذهب", 18, 420, 14, rgb(229, 197, 118), Paint.Align.LEFT, true);
            txt(c, "سعر المثقال · 5 غرام", 402, 420, 10, rgb(125, 137, 153), Paint.Align.RIGHT, true);

            goldCard(c, 18, 442, 140, 566, "18K", "عيار 18", data.gold18);
            goldCard(c, 149, 442, 271, 566, "21K", "عيار 21", data.gold21);
            goldCard(c, 280, 442, 402, 566, "24K", "عيار 24", data.gold24);

            // Footer
            round(c, 18, 586, 402, 670, 20, rgb(13, 18, 26));
            String updated = data.updatedAt > 0
                    ? "آخر تحديث  " + new SimpleDateFormat("hh:mm:ss a", Locale.US).format(new Date(data.updatedAt))
                    : "بانتظار التحديث";
            txt(c, updated, 145, 618, 9, rgb(118, 130, 146), Paint.Align.CENTER, true);
            txt(c, "MazenmiX", 145, 646, 11, rgb(229, 197, 118), Paint.Align.CENTER, true);

            round(c, 276, 608, 392, 654, 14, refreshing ? rgb(31, 73, 104) : rgb(36, 112, 168));
            txt(c, refreshing ? "جارِ التحديث..." : "تحديث الأسعار", 334, 636, 10,
                    Color.WHITE, Paint.Align.CENTER, true);

            // Update card
            round(c, 18, 690, 402, 756, 16, rgb(14, 20, 28));
            stroke(c, 18, 690, 402, 756, 16, rgb(36, 46, 59), 1);
            String version = currentVersion();
            if (updateInfo.available || downloadingUpdate) {
                txt(c, updateInfo.status, 140, 726, 9,
                        downloadingUpdate ? rgb(131, 192, 247) : rgb(103, 224, 168),
                        Paint.Align.CENTER, true);
                round(c, 275, 704, 392, 748, 13,
                        downloadingUpdate ? rgb(31, 73, 61) : rgb(29, 118, 82));
                txt(c, downloadingUpdate ? "جاري التحديث..." : "UPDATE NOW", 333, 731, 9,
                        Color.WHITE, Paint.Align.CENTER, true);
            } else {
                txt(c, "MX Dollar v" + version + " · " + updateInfo.status, 210, 726, 9,
                        rgb(132, 145, 161), Paint.Align.CENTER, true);
            }

            // Bottom branding accent
            txt(c, "MX DOLLAR ANDROID · MAZENMIX", 210, 774, 8,
                    rgb(73, 85, 99), Paint.Align.CENTER, true);
        }

        private void sourceCard(Canvas c, float l, float t, float r, float b,
                                String ar, String code, int buy, int sell) {
            round(c, l, t, r, b, 18, rgb(15, 21, 30));
            stroke(c, l, t, r, b, 18, rgb(37, 46, 58), 1);
            txt(c, code, l + 14, t + 27, 9, rgb(104, 178, 236), Paint.Align.LEFT, true);
            txt(c, ar, r - 14, t + 27, 10, rgb(185, 194, 205), Paint.Align.RIGHT, true);
            txt(c, "بيع", l + 14, t + 58, 9, rgb(220, 160, 98), Paint.Align.LEFT, true);
            txt(c, formatIQD(sell), r - 14, t + 60, 14, Color.WHITE, Paint.Align.RIGHT, true);
            txt(c, "شراء", l + 14, t + 88, 9, rgb(91, 204, 148), Paint.Align.LEFT, true);
            txt(c, formatIQD(buy), r - 14, t + 90, 14, Color.WHITE, Paint.Align.RIGHT, true);
        }

        private void goldCard(Canvas c, float l, float t, float r, float b,
                              String code, String ar, int value) {
            round(c, l, t, r, b, 18, rgb(18, 22, 28));
            stroke(c, l, t, r, b, 18, rgb(59, 52, 37), 1);
            round(c, l + 12, t + 14, l + 58, t + 41, 13, rgb(48, 40, 24));
            txt(c, code, l + 35, t + 33, 9, rgb(229, 197, 118), Paint.Align.CENTER, true);
            txt(c, ar, r - 12, t + 33, 9, rgb(151, 160, 172), Paint.Align.RIGHT, true);
            txt(c, formatIQD(value), (l + r) / 2, t + 82, 17, rgb(246, 242, 230), Paint.Align.CENTER, true);
            txt(c, "د.ع", (l + r) / 2, t + 108, 8, rgb(124, 115, 91), Paint.Align.CENTER, true);
        }

        @Override
        public boolean onTouchEvent(MotionEvent e) {
            if (e.getAction() != MotionEvent.ACTION_UP) return true;
            float bx = e.getX() / s();
            float by = e.getY() / s();

            if (refreshRect.contains(bx, by)) {
                refreshMarkets(true);
                return true;
            }

            if (updateRect.contains(bx, by) && updateInfo.available && !downloadingUpdate) {
                downloadUpdate();
                return true;
            }

            return true;
        }

        private void txt(Canvas c, String text, float x, float y, float size,
                         int color, Paint.Align align, boolean bold) {
            p.setStyle(Paint.Style.FILL);
            p.setColor(color);
            p.setTextSize(X(size));
            p.setTextAlign(align);
            p.setTypeface(Typeface.create("sans", bold ? Typeface.BOLD : Typeface.NORMAL));
            c.drawText(text, X(x), X(y), p);
        }

        private void rect(Canvas c, float l, float t, float r, float b, int color, float radius) {
            p.setStyle(Paint.Style.FILL);
            p.setColor(color);
            c.drawRect(X(l), X(t), X(r), X(b), p);
        }

        private void round(Canvas c, float l, float t, float r, float b, float radius, int color) {
            p.setStyle(Paint.Style.FILL);
            p.setColor(color);
            c.drawRoundRect(X(l), X(t), X(r), X(b), X(radius), X(radius), p);
        }

        private void stroke(Canvas c, float l, float t, float r, float b, float radius, int color, float width) {
            p.setStyle(Paint.Style.STROKE);
            p.setStrokeWidth(X(width));
            p.setColor(color);
            c.drawRoundRect(X(l), X(t), X(r), X(b), X(radius), X(radius), p);
            p.setStyle(Paint.Style.FILL);
        }

        private void dot(Canvas c, float x, float y, float radius, int color) {
            p.setStyle(Paint.Style.FILL);
            p.setColor(color);
            c.drawCircle(X(x), X(y), X(radius), p);
        }
    }

    private static int rgb(int r, int g, int b) {
        return Color.rgb(r, g, b);
    }
}
