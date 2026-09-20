package com.mazenmix.mxdollar;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.text.Html;
import android.view.View;
import android.widget.*;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.security.MessageDigest;
import java.text.DecimalFormat;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.*;
import java.util.regex.*;

public class MainActivity extends Activity {
    private static final String UPDATE_URL =
        "https://raw.githubusercontent.com/mazenmix/windows-cleaner/main/mx-dollar-android/update-android.json";

    private final ExecutorService pool = Executors.newSingleThreadExecutor();
    private final Handler ui = new Handler(Looper.getMainLooper());

    private TextView heroPrice, heroBuy, heroSell, kifahSell, kifahBuy, harSell, harBuy;
    private TextView g18, g21, g24, updated, updateText;
    private Button refreshBtn, updateBtn;

    private Market market = new Market();
    private UpdateInfo update = new UpdateInfo();
    private boolean refreshing = false;
    private boolean downloading = false;
    private long downloadId = -1;
    private Uri pendingInstall;
    private BroadcastReceiver receiver;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);

        // Render a real XML layout first. No networking or background work can block this.
        setContentView(R.layout.activity_main);

        bindViews();
        loadCache();
        render();

        getWindow().setStatusBarColor(android.graphics.Color.rgb(10,14,20));
        getWindow().setNavigationBarColor(android.graphics.Color.rgb(10,14,20));

        refreshBtn.setOnClickListener(v -> refreshMarkets(true));
        updateBtn.setOnClickListener(v -> downloadUpdate());

        createNotificationChannel();
        requestNotificationPermission();
        registerDownloadReceiver();

        // Network work starts only after UI is already visible.
        ui.post(() -> {
            refreshMarkets(false);
            checkForUpdate();
        });

        ui.postDelayed(new Runnable() {
            @Override public void run() {
                refreshMarkets(false);
                ui.postDelayed(this, 60_000);
            }
        }, 60_000);

        ui.postDelayed(new Runnable() {
            @Override public void run() {
                checkForUpdate();
                ui.postDelayed(this, 3_600_000);
            }
        }, 3_600_000);
    }

    private void bindViews() {
        heroPrice = findViewById(R.id.heroPrice);
        heroBuy = findViewById(R.id.heroBuy);
        heroSell = findViewById(R.id.heroSell);
        kifahSell = findViewById(R.id.kifahSell);
        kifahBuy = findViewById(R.id.kifahBuy);
        harSell = findViewById(R.id.harSell);
        harBuy = findViewById(R.id.harBuy);
        g18 = findViewById(R.id.g18);
        g21 = findViewById(R.id.g21);
        g24 = findViewById(R.id.g24);
        updated = findViewById(R.id.updated);
        updateText = findViewById(R.id.updateText);
        refreshBtn = findViewById(R.id.refreshBtn);
        updateBtn = findViewById(R.id.updateBtn);
    }

    private void render() {
        heroPrice.setText(formatIQD(market.highSell()));
        heroBuy.setText("شراء  " + formatIQD(market.highBuy()));
        heroSell.setText("بيع  " + formatIQD(market.highSell()));

        kifahSell.setText("بيع  " + formatIQD(market.kifahSell));
        kifahBuy.setText("شراء  " + formatIQD(market.kifahBuy));
        harSell.setText("بيع  " + formatIQD(market.harithiyaSell));
        harBuy.setText("شراء  " + formatIQD(market.harithiyaBuy));

        g18.setText(formatIQD(market.gold18));
        g21.setText(formatIQD(market.gold21));
        g24.setText(formatIQD(market.gold24));

        if (market.updatedAt > 0) {
            updated.setText("آخر تحديث  " +
                new SimpleDateFormat("hh:mm:ss a", Locale.US).format(new Date(market.updatedAt)));
        } else {
            updated.setText("بانتظار التحديث");
        }

        refreshBtn.setEnabled(!refreshing);
        refreshBtn.setText(refreshing ? "جارِ التحديث..." : "تحديث الأسعار");

        updateText.setText("MX Dollar v" + currentVersion() + " · " + update.status);
        updateBtn.setVisibility(update.available || downloading ? View.VISIBLE : View.GONE);
        updateBtn.setEnabled(update.available && !downloading);
        updateBtn.setText(downloading ? "جاري التحديث..." : "UPDATE NOW");
    }

    private void refreshMarkets(boolean manual) {
        if (refreshing) return;
        refreshing = true;
        render();
        final int oldHigh = market.highSell();

        pool.execute(() -> {
            Market fresh = new Market();
            Exception failure = null;
            try {
                parseDollar(fetchText("https://t.me/s/dollariraqi"), fresh);
                parseGold(fetchText("https://mithqaly.com/%D8%A7%D8%B3%D8%B9%D8%A7%D8%B1-%D8%A7%D9%84%D8%B0%D9%87%D8%A8/"), fresh);
                fresh.updatedAt = System.currentTimeMillis();
                if (fresh.highSell() == 0 && fresh.gold21 == 0) {
                    throw new IOException("No market data");
                }
            } catch (Exception e) {
                failure = e;
            }

            final Exception error = failure;
            ui.post(() -> {
                if (error == null) {
                    market = fresh;
                    saveCache();
                    int now = market.highSell();
                    if (oldHigh > 0 && now > 0 && oldHigh != now) {
                        notifyPrice(oldHigh, now);
                    } else if (manual) {
                        Toast.makeText(this, "تم تحديث الأسعار", Toast.LENGTH_SHORT).show();
                    }
                } else if (manual) {
                    Toast.makeText(this, "تعذر تحديث الأسعار حالياً", Toast.LENGTH_SHORT).show();
                }
                refreshing = false;
                render();
            });
        });
    }

    private void checkForUpdate() {
        update.status = "جاري فحص التحديث...";
        render();

        pool.execute(() -> {
            try {
                JSONObject obj = new JSONObject(fetchText(UPDATE_URL + "?t=" + System.currentTimeMillis()));
                UpdateInfo next = new UpdateInfo();
                next.version = obj.optString("version", "");
                next.url = obj.optString("url", "");
                next.sha256 = obj.optString("sha256", "");
                next.available = compareVersions(next.version, currentVersion()) > 0;
                next.status = next.available ? "Update Available · v" + next.version : "التطبيق محدّث";
                ui.post(() -> {
                    update = next;
                    render();
                });
            } catch (Exception e) {
                ui.post(() -> {
                    update.available = false;
                    update.status = "تعذر فحص التحديث";
                    render();
                });
            }
        });
    }

    private void downloadUpdate() {
        if (!update.available || downloading || update.url.isEmpty()) return;
        try {
            DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
            DownloadManager.Request req = new DownloadManager.Request(Uri.parse(update.url));
            req.setTitle("MX Dollar v" + update.version);
            req.setDescription("Downloading update...");
            req.setMimeType("application/vnd.android.package-archive");
            req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            req.setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS,
                    "MX.Dollar.v" + update.version + ".apk");
            downloadId = dm.enqueue(req);
            downloading = true;
            update.status = "جاري تنزيل التحديث...";
            render();
        } catch (Exception e) {
            Toast.makeText(this, "فشل بدء تنزيل التحديث", Toast.LENGTH_LONG).show();
        }
    }

    private void registerDownloadReceiver() {
        receiver = new BroadcastReceiver() {
            @Override public void onReceive(Context context, Intent intent) {
                if (!DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction())) return;
                if (intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1) != downloadId) return;
                verifyAndInstall();
            }
        };
        IntentFilter f = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(receiver, f, Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(receiver, f);
    }

    private void verifyAndInstall() {
        pool.execute(() -> {
            try {
                DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                Uri uri = dm.getUriForDownloadedFile(downloadId);
                if (uri == null) throw new IOException("Missing APK");
                String actual = sha256(uri);
                if (!actual.equalsIgnoreCase(update.sha256)) throw new SecurityException("SHA mismatch");

                ui.post(() -> {
                    downloading = false;
                    update.status = "اكتمل التنزيل · جاهز للتثبيت";
                    render();

                    if (Build.VERSION.SDK_INT >= 26 && !getPackageManager().canRequestPackageInstalls()) {
                        pendingInstall = uri;
                        Intent s = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                Uri.parse("package:" + getPackageName()));
                        startActivity(s);
                        Toast.makeText(this,
                                "فعّل السماح بالتثبيت من MX Dollar ثم ارجع",
                                Toast.LENGTH_LONG).show();
                    } else {
                        openInstaller(uri);
                    }
                });
            } catch (Exception e) {
                ui.post(() -> {
                    downloading = false;
                    update.status = "فشل التحقق من التحديث";
                    render();
                    Toast.makeText(this, "فشل التحديث", Toast.LENGTH_LONG).show();
                });
            }
        });
    }

    @Override protected void onResume() {
        super.onResume();
        if (pendingInstall != null && Build.VERSION.SDK_INT >= 26 &&
                getPackageManager().canRequestPackageInstalls()) {
            Uri uri = pendingInstall;
            pendingInstall = null;
            openInstaller(uri);
        }
    }

    private void openInstaller(Uri uri) {
        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setDataAndType(uri, "application/vnd.android.package-archive");
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(i);
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 &&
                checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 41);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel c = new NotificationChannel(
                    "mx_price", "MX Dollar Price Changes", NotificationManager.IMPORTANCE_DEFAULT);
            ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(c);
        }
    }

    private void notifyPrice(int oldPrice, int newPrice) {
        if (Build.VERSION.SDK_INT >= 33 &&
                checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        Notification.Builder b = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(this, "mx_price")
                : new Notification.Builder(this);
        b.setSmallIcon(android.R.drawable.stat_notify_sync)
                .setContentTitle("MX Dollar " + (newPrice > oldPrice ? "▲" : "▼"))
                .setContentText("أعلى سعر الآن " + formatIQD(newPrice) + " د.ع لكل 100$")
                .setAutoCancel(true);
        ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).notify(102, b.build());
    }

    private String fetchText(String address) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(address).openConnection();
        c.setConnectTimeout(12000);
        c.setReadTimeout(15000);
        c.setUseCaches(false);
        c.setRequestProperty("User-Agent", "MX-Dollar-Android/" + currentVersion());
        c.setRequestProperty("Accept-Language", "ar-IQ,ar;q=0.9,en;q=0.8");
        int code = c.getResponseCode();
        if (code < 200 || code >= 300) throw new IOException("HTTP " + code);
        StringBuilder out = new StringBuilder();
        try (BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream()))) {
            String line;
            while ((line = r.readLine()) != null) out.append(line).append('\n');
        } finally {
            c.disconnect();
        }
        return out.toString();
    }

    private static String plainText(String html) {
        String s = html.replaceAll("(?is)<script.*?</script>|<style.*?</style>", " ")
                .replaceAll("(?s)<[^>]*>", "\n");
        return Html.fromHtml(s, Html.FROM_HTML_MODE_LEGACY).toString()
                .replace('\u200f', ' ').replace('\u200e', ' ').replaceAll("\\s+", " ");
    }

    private static void parseDollar(String html, Market out) {
        String text = plainText(html);
        parseMarket(text, "كفاح", true, out);
        parseMarket(text, "حارثية", false, out);
    }

    private static void parseMarket(String text, String name, boolean kifah, Market out) {
        Matcher m = Pattern.compile(name + "\\s*([0-9]{4}\\.[0-9]{2})\\s*\\|\\s*([0-9]{4}\\.[0-9]{2})").matcher(text);
        double buy = 0, sell = 0;
        while (m.find()) {
            buy = Double.parseDouble(m.group(1));
            sell = Double.parseDouble(m.group(2));
        }
        if (kifah) {
            out.kifahBuy = (int)Math.round(buy * 100);
            out.kifahSell = (int)Math.round(sell * 100);
        } else {
            out.harithiyaBuy = (int)Math.round(buy * 100);
            out.harithiyaSell = (int)Math.round(sell * 100);
        }
    }

    private static void parseGold(String html, Market out) {
        String text = plainText(html);
        out.gold21 = goldValue(text, "21");
        out.gold24 = goldValue(text, "24");
        if (out.gold24 > 0) out.gold18 = (int)Math.round(out.gold24 * 0.75);
        else if (out.gold21 > 0) {
            out.gold18 = (int)Math.round(out.gold21 * (18.0 / 21.0));
            out.gold24 = (int)Math.round(out.gold21 * (24.0 / 21.0));
        }
    }

    private static int goldValue(String text, String karat) {
        Matcher m = Pattern.compile("مثقال ذهب عيار\\s*" + karat +
                "[^0-9]{0,80}([0-9]{2,3}(?:,[0-9]{3}){1,2})\\s*د\\.ع").matcher(text);
        return m.find() ? Integer.parseInt(m.group(1).replace(",", "")) : 0;
    }

    private void loadCache() {
        SharedPreferences p = getSharedPreferences("mx_cache", MODE_PRIVATE);
        market.kifahBuy = p.getInt("kb", 0);
        market.kifahSell = p.getInt("ks", 0);
        market.harithiyaBuy = p.getInt("hb", 0);
        market.harithiyaSell = p.getInt("hs", 0);
        market.gold18 = p.getInt("g18", 0);
        market.gold21 = p.getInt("g21", 0);
        market.gold24 = p.getInt("g24", 0);
        market.updatedAt = p.getLong("updated", 0);
    }

    private void saveCache() {
        getSharedPreferences("mx_cache", MODE_PRIVATE).edit()
                .putInt("kb", market.kifahBuy)
                .putInt("ks", market.kifahSell)
                .putInt("hb", market.harithiyaBuy)
                .putInt("hs", market.harithiyaSell)
                .putInt("g18", market.gold18)
                .putInt("g21", market.gold21)
                .putInt("g24", market.gold24)
                .putLong("updated", market.updatedAt)
                .apply();
    }

    private String currentVersion() {
        try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; }
        catch (Exception e) { return "1.0.2"; }
    }

    private static int compareVersions(String a, String b) {
        String[] x = a.replace("v","").split("\\.");
        String[] y = b.replace("v","").split("\\.");
        int n = Math.max(x.length, y.length);
        for (int i=0;i<n;i++) {
            int A = i<x.length ? leadingInt(x[i]) : 0;
            int B = i<y.length ? leadingInt(y[i]) : 0;
            if (A != B) return Integer.compare(A,B);
        }
        return 0;
    }

    private static int leadingInt(String s) {
        try {
            Matcher m = Pattern.compile("^\\d+").matcher(s);
            return m.find() ? Integer.parseInt(m.group()) : 0;
        } catch (Exception e) { return 0; }
    }

    private String sha256(Uri uri) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        try (InputStream in = getContentResolver().openInputStream(uri)) {
            if (in == null) throw new IOException("Cannot open APK");
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) md.update(buf,0,n);
        }
        StringBuilder s = new StringBuilder();
        for (byte b : md.digest()) s.append(String.format(Locale.US,"%02x",b));
        return s.toString();
    }

    private static String formatIQD(int n) {
        return n > 0 ? new DecimalFormat("#,###").format(n) : "—";
    }

    @Override protected void onDestroy() {
        super.onDestroy();
        ui.removeCallbacksAndMessages(null);
        pool.shutdownNow();
        if (receiver != null) {
            try { unregisterReceiver(receiver); } catch (Exception ignored) {}
        }
    }

    static class Market {
        int kifahBuy, kifahSell, harithiyaBuy, harithiyaSell;
        int gold18, gold21, gold24;
        long updatedAt;
        int highSell() { return Math.max(kifahSell, harithiyaSell); }
        int highBuy() { return Math.max(kifahBuy, harithiyaBuy); }
    }

    static class UpdateInfo {
        String version="", url="", sha256="", status="جاري فحص التحديث...";
        boolean available=false;
    }
}
