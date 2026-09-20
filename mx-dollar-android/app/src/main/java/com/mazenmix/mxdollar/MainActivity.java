package com.mazenmix.mxdollar;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.text.Html;
import android.view.*;
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
    static final String UPDATE_URL="https://raw.githubusercontent.com/mazenmix/windows-cleaner/main/mx-dollar-android/update-android.json";
    final ExecutorService pool=Executors.newSingleThreadExecutor();
    final Handler ui=new Handler(Looper.getMainLooper());
    Market m=new Market(); UpdateInfo up=new UpdateInfo();
    boolean refreshing=false, downloading=false; long downloadId=-1; Uri pendingInstall;
    TextView heroPrice, heroBuy, heroSell, kifahBuy, kifahSell, harBuy, harSell, g18, g21, g24, updated, brand, updateText;
    Button refreshBtn, updateBtn;
    BroadcastReceiver receiver;

    @Override public void onCreate(Bundle b){
        super.onCreate(b);
        getWindow().setStatusBarColor(Color.rgb(10,14,20));
        getWindow().setNavigationBarColor(Color.rgb(10,14,20));
        if(Build.VERSION.SDK_INT>=33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},41);
        loadCache();
        setContentView(buildUi());
        createChannel();
        registerDownloadReceiver();
        render();
        refresh(false);
        checkUpdate();
        ui.postDelayed(new Runnable(){ public void run(){ refresh(false); ui.postDelayed(this,60000); }},60000);
        ui.postDelayed(new Runnable(){ public void run(){ checkUpdate(); ui.postDelayed(this,3600000); }},3600000);
    }

    View buildUi(){
        ScrollView sc=new ScrollView(this);
        sc.setFillViewport(true); sc.setBackgroundColor(c(10,14,20));
        LinearLayout root=vbox(); root.setPadding(dp(18),dp(18),dp(18),dp(24));
        sc.addView(root,new ScrollView.LayoutParams(-1,-2));

        LinearLayout head=hbox(); head.setGravity(Gravity.CENTER_VERTICAL);
        TextView icon=tv("$",22,Color.rgb(229,197,118),true); icon.setGravity(Gravity.CENTER);
        icon.setBackground(bg(c(25,33,45),20,c(229,197,118),1)); head.addView(icon,new LinearLayout.LayoutParams(dp(44),dp(44)));
        LinearLayout titles=vbox(); LinearLayout.LayoutParams tp=new LinearLayout.LayoutParams(0,-2,1); tp.leftMargin=dp(12);
        TextView t1=tv("MX DOLLAR",20,Color.WHITE,true); TextView t2=tv("IRAQ MARKET WATCH",10,c(125,137,153),true);
        titles.addView(t1); titles.addView(t2); head.addView(titles,tp);
        TextView live=tv("●  LIVE",10,c(103,224,168),true); live.setGravity(Gravity.CENTER); live.setBackground(bg(c(19,43,35),18,0,0));
        head.addView(live,new LinearLayout.LayoutParams(dp(78),dp(34))); root.addView(head);

        root.addView(space(16));
        LinearLayout hero=vbox(); hero.setPadding(dp(18),dp(16),dp(18),dp(16)); hero.setBackground(bg(c(16,22,31),24,c(43,52,65),1));
        hero.addView(tv("USD / IQD",12,c(131,192,247),true));
        TextView sub=tv("السعر الأعلى الآن لكل 100$",12,c(172,181,193),true); sub.setGravity(Gravity.RIGHT); hero.addView(sub);
        heroPrice=tv("—",36,Color.WHITE,true); heroPrice.setPadding(0,dp(4),0,0); hero.addView(heroPrice);
        LinearLayout chips=hbox(); chips.setGravity(Gravity.CENTER);
        LinearLayout buyChip=chip(c(18,37,31)); heroBuy=tv("شراء  —",13,c(103,224,168),true); buyChip.addView(heroBuy); chips.addView(buyChip,new LinearLayout.LayoutParams(0,dp(52),1));
        chips.addView(spaceH(10));
        LinearLayout sellChip=chip(c(42,31,25)); heroSell=tv("بيع  —",13,c(241,180,111),true); sellChip.addView(heroSell); chips.addView(sellChip,new LinearLayout.LayoutParams(0,dp(52),1));
        hero.addView(chips); root.addView(hero);

        root.addView(space(14));
        LinearLayout markets=hbox();
        View kc=marketCard("KIFAH","بورصة الكفاح",true); View hc=marketCard("HARITHIYA","بورصة الحارثية",false);
        markets.addView(kc,new LinearLayout.LayoutParams(0,-2,1)); markets.addView(spaceH(10)); markets.addView(hc,new LinearLayout.LayoutParams(0,-2,1));
        root.addView(markets);

        root.addView(space(18));
        LinearLayout goldHead=hbox(); goldHead.setGravity(Gravity.CENTER_VERTICAL);
        goldHead.addView(tv("GOLD · الذهب",15,c(229,197,118),true),new LinearLayout.LayoutParams(0,-2,1));
        TextView gh=tv("سعر المثقال · 5 غرام",10,c(125,137,153),true); gh.setGravity(Gravity.RIGHT); goldHead.addView(gh);
        root.addView(goldHead); root.addView(space(10));
        LinearLayout gold=hbox();
        g18=goldCard(gold,"18K","عيار 18"); gold.addView(spaceH(8));
        g21=goldCard(gold,"21K","عيار 21"); gold.addView(spaceH(8));
        g24=goldCard(gold,"24K","عيار 24");
        root.addView(gold);

        root.addView(space(16));
        LinearLayout foot=vbox(); foot.setPadding(dp(14),dp(12),dp(14),dp(12)); foot.setBackground(bg(c(13,18,26),20,0,0));
        updated=tv("بانتظار التحديث",10,c(118,130,146),true); updated.setGravity(Gravity.CENTER); foot.addView(updated);
        brand=tv("MazenmiX",12,c(229,197,118),true); brand.setGravity(Gravity.CENTER); foot.addView(brand);
        refreshBtn=button("تحديث الأسعار",c(36,112,168)); refreshBtn.setOnClickListener(v->refresh(true));
        LinearLayout.LayoutParams bp=new LinearLayout.LayoutParams(-1,dp(48)); bp.topMargin=dp(10); foot.addView(refreshBtn,bp); root.addView(foot);

        root.addView(space(14));
        LinearLayout upd=vbox(); upd.setPadding(dp(14),dp(12),dp(14),dp(12)); upd.setBackground(bg(c(14,20,28),16,c(36,46,59),1));
        updateText=tv("جاري فحص التحديث...",10,c(132,145,161),true); updateText.setGravity(Gravity.CENTER); upd.addView(updateText);
        updateBtn=button("UPDATE NOW",c(29,118,82)); updateBtn.setVisibility(View.GONE); updateBtn.setOnClickListener(v->downloadUpdate());
        LinearLayout.LayoutParams upb=new LinearLayout.LayoutParams(-1,dp(46)); upb.topMargin=dp(10); upd.addView(updateBtn,upb); root.addView(upd);

        TextView bottom=tv("MX DOLLAR ANDROID · MAZENMIX",9,c(73,85,99),true); bottom.setGravity(Gravity.CENTER); bottom.setPadding(0,dp(16),0,0); root.addView(bottom);
        return sc;
    }

    View marketCard(String code,String name,boolean kifah){
        LinearLayout card=vbox(); card.setPadding(dp(12),dp(12),dp(12),dp(12)); card.setBackground(bg(c(15,21,30),18,c(37,46,58),1));
        card.addView(tv(code,10,c(104,178,236),true));
        TextView n=tv(name,11,c(185,194,205),true); n.setGravity(Gravity.RIGHT); card.addView(n);
        TextView s=tv("بيع  —",14,c(220,160,98),true); TextView b=tv("شراء  —",14,c(91,204,148),true);
        card.addView(s); card.addView(b);
        if(kifah){kifahSell=s;kifahBuy=b;}else{harSell=s;harBuy=b;}
        return card;
    }

    TextView goldCard(LinearLayout parent,String code,String name){
        LinearLayout card=vbox(); card.setPadding(dp(10),dp(10),dp(10),dp(10)); card.setGravity(Gravity.CENTER);
        card.setBackground(bg(c(18,22,28),18,c(59,52,37),1));
        TextView tag=tv(code,10,c(229,197,118),true); tag.setGravity(Gravity.CENTER); card.addView(tag);
        TextView nm=tv(name,9,c(151,160,172),true); nm.setGravity(Gravity.CENTER); card.addView(nm);
        TextView val=tv("—",17,c(246,242,230),true); val.setGravity(Gravity.CENTER); val.setPadding(0,dp(8),0,0); card.addView(val);
        TextView iq=tv("د.ع",9,c(124,115,91),true); iq.setGravity(Gravity.CENTER); card.addView(iq);
        parent.addView(card,new LinearLayout.LayoutParams(0,dp(132),1)); return val;
    }

    void render(){
        heroPrice.setText(f(m.highSell()));
        heroBuy.setText("شراء  "+f(m.highBuy()));
        heroSell.setText("بيع  "+f(m.highSell()));
        kifahBuy.setText("شراء  "+f(m.kBuy)); kifahSell.setText("بيع  "+f(m.kSell));
        harBuy.setText("شراء  "+f(m.hBuy)); harSell.setText("بيع  "+f(m.hSell));
        g18.setText(f(m.g18)); g21.setText(f(m.g21)); g24.setText(f(m.g24));
        updated.setText(m.updated>0 ? "آخر تحديث  "+new SimpleDateFormat("hh:mm:ss a",Locale.US).format(new Date(m.updated)) : "بانتظار التحديث");
        refreshBtn.setText(refreshing?"جارِ التحديث...":"تحديث الأسعار"); refreshBtn.setEnabled(!refreshing);
        updateText.setText("MX Dollar v"+version()+" · "+up.status);
        updateBtn.setVisibility(up.available||downloading?View.VISIBLE:View.GONE);
        updateBtn.setText(downloading?"جاري التحديث...":"UPDATE NOW"); updateBtn.setEnabled(!downloading);
    }

    void refresh(boolean manual){
        if(refreshing)return; refreshing=true; render(); final int old=m.highSell();
        pool.execute(()->{
            Market n=new Market(); String err=null;
            try{ parseDollar(fetch("https://t.me/s/dollariraqi"),n); parseGold(fetch("https://mithqaly.com/%D8%A7%D8%B3%D8%B9%D8%A7%D8%B1-%D8%A7%D9%84%D8%B0%D9%87%D8%A8/"),n); n.updated=System.currentTimeMillis(); if(n.highSell()==0&&n.g21==0)throw new Exception(); }
            catch(Exception e){err="x";}
            String er=err; ui.post(()->{ if(er==null){m=n;saveCache();if(old>0&&m.highSell()>0&&old!=m.highSell())notifyPrice(old,m.highSell());else if(manual)Toast.makeText(this,"تم تحديث الأسعار",Toast.LENGTH_SHORT).show();}else if(manual)Toast.makeText(this,"تعذر تحديث الأسعار حالياً",Toast.LENGTH_SHORT).show();refreshing=false;render();});
        });
    }

    void checkUpdate(){
        up.status="جاري فحص التحديث..."; render();
        pool.execute(()->{
            try{JSONObject o=new JSONObject(fetch(UPDATE_URL+"?t="+System.currentTimeMillis()));UpdateInfo n=new UpdateInfo();n.version=o.optString("version");n.url=o.optString("url");n.sha=o.optString("sha256");n.available=cmp(n.version,version())>0;n.status=n.available?"Update Available · v"+n.version:"التطبيق محدّث";ui.post(()->{up=n;render();});}
            catch(Exception e){ui.post(()->{up.status="تعذر فحص التحديث";up.available=false;render();});}
        });
    }

    void downloadUpdate(){
        if(!up.available||downloading)return;
        try{DownloadManager dm=(DownloadManager)getSystemService(DOWNLOAD_SERVICE);DownloadManager.Request r=new DownloadManager.Request(Uri.parse(up.url));r.setTitle("MX Dollar v"+up.version);r.setMimeType("application/vnd.android.package-archive");r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);r.setDestinationInExternalFilesDir(this,Environment.DIRECTORY_DOWNLOADS,"MX.Dollar.update.apk");downloadId=dm.enqueue(r);downloading=true;up.status="جاري تنزيل التحديث...";render();}
        catch(Exception e){Toast.makeText(this,"فشل بدء التحديث",Toast.LENGTH_LONG).show();}
    }

    void registerDownloadReceiver(){
        receiver=new BroadcastReceiver(){public void onReceive(Context c,Intent i){if(DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(i.getAction())&&i.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID,-1)==downloadId)verifyInstall();}};
        IntentFilter f=new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE); if(Build.VERSION.SDK_INT>=33)registerReceiver(receiver,f,Context.RECEIVER_NOT_EXPORTED);else registerReceiver(receiver,f);
    }

    void verifyInstall(){
        pool.execute(()->{try{DownloadManager dm=(DownloadManager)getSystemService(DOWNLOAD_SERVICE);Uri u=dm.getUriForDownloadedFile(downloadId);if(u==null||!sha256(u).equalsIgnoreCase(up.sha))throw new Exception();ui.post(()->{downloading=false;up.status="اكتمل التنزيل · جاهز للتثبيت";render();if(Build.VERSION.SDK_INT>=26&&!getPackageManager().canRequestPackageInstalls()){pendingInstall=u;startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+getPackageName())));}else install(u);});}catch(Exception e){ui.post(()->{downloading=false;up.status="فشل التحقق من التحديث";render();Toast.makeText(this,"فشل التحديث",Toast.LENGTH_LONG).show();});}});
    }

    @Override protected void onResume(){super.onResume();if(pendingInstall!=null&&Build.VERSION.SDK_INT>=26&&getPackageManager().canRequestPackageInstalls()){Uri u=pendingInstall;pendingInstall=null;install(u);}}
    void install(Uri u){Intent i=new Intent(Intent.ACTION_VIEW);i.setDataAndType(u,"application/vnd.android.package-archive");i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_ACTIVITY_NEW_TASK);startActivity(i);}
    String sha256(Uri u)throws Exception{MessageDigest md=MessageDigest.getInstance("SHA-256");try(InputStream in=getContentResolver().openInputStream(u)){byte[]b=new byte[8192];int n;while((n=in.read(b))>0)md.update(b,0,n);}StringBuilder s=new StringBuilder();for(byte b:md.digest())s.append(String.format(Locale.US,"%02x",b));return s.toString();}

    String fetch(String u)throws Exception{HttpURLConnection c=(HttpURLConnection)new URL(u).openConnection();c.setConnectTimeout(12000);c.setReadTimeout(15000);c.setRequestProperty("User-Agent","MX-Dollar-Android/"+version());c.setRequestProperty("Accept-Language","ar-IQ,ar;q=0.9,en;q=0.8");int code=c.getResponseCode();if(code<200||code>=300)throw new IOException();StringBuilder s=new StringBuilder();try(BufferedReader r=new BufferedReader(new InputStreamReader(c.getInputStream()))){String l;while((l=r.readLine())!=null)s.append(l).append('\n');}finally{c.disconnect();}return s.toString();}
    static String plain(String h){String s=h.replaceAll("(?is)<script.*?</script>|<style.*?</style>"," ").replaceAll("(?s)<[^>]*>","\n");return Html.fromHtml(s,Html.FROM_HTML_MODE_LEGACY).toString().replace('\u200f',' ').replace('\u200e',' ').replaceAll("\\s+"," ");}
    static void parseDollar(String h,Market o){String t=plain(h); parseM(t,"كفاح",true,o);parseM(t,"حارثية",false,o);}
    static void parseM(String t,String n,boolean k,Market o){Matcher m=Pattern.compile(n+"\\s*([0-9]{4}\\.[0-9]{2})\\s*\\|\\s*([0-9]{4}\\.[0-9]{2})").matcher(t);double b=0,s=0;while(m.find()){b=Double.parseDouble(m.group(1));s=Double.parseDouble(m.group(2));}if(k){o.kBuy=(int)Math.round(b*100);o.kSell=(int)Math.round(s*100);}else{o.hBuy=(int)Math.round(b*100);o.hSell=(int)Math.round(s*100);}}
    static void parseGold(String h,Market o){String t=plain(h);o.g21=gold(t,"21");o.g24=gold(t,"24");if(o.g24>0)o.g18=(int)Math.round(o.g24*.75);else if(o.g21>0){o.g18=(int)Math.round(o.g21*(18d/21d));o.g24=(int)Math.round(o.g21*(24d/21d));}}
    static int gold(String t,String k){Matcher m=Pattern.compile("مثقال ذهب عيار\\s*"+k+"[^0-9]{0,80}([0-9]{2,3}(?:,[0-9]{3}){1,2})\\s*د\\.ع").matcher(t);return m.find()?Integer.parseInt(m.group(1).replace(",","")):0;}

    void loadCache(){SharedPreferences p=getSharedPreferences("mx",0);m.kBuy=p.getInt("kb",0);m.kSell=p.getInt("ks",0);m.hBuy=p.getInt("hb",0);m.hSell=p.getInt("hs",0);m.g18=p.getInt("g18",0);m.g21=p.getInt("g21",0);m.g24=p.getInt("g24",0);m.updated=p.getLong("u",0);}
    void saveCache(){getSharedPreferences("mx",0).edit().putInt("kb",m.kBuy).putInt("ks",m.kSell).putInt("hb",m.hBuy).putInt("hs",m.hSell).putInt("g18",m.g18).putInt("g21",m.g21).putInt("g24",m.g24).putLong("u",m.updated).apply();}
    void createChannel(){if(Build.VERSION.SDK_INT>=26)((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(new NotificationChannel("mx","MX Dollar",NotificationManager.IMPORTANCE_DEFAULT));}
    void notifyPrice(int old,int now){if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return;Notification.Builder b=Build.VERSION.SDK_INT>=26?new Notification.Builder(this,"mx"):new Notification.Builder(this);b.setSmallIcon(android.R.drawable.stat_notify_sync).setContentTitle("MX Dollar "+(now>old?"▲":"▼")).setContentText("أعلى سعر الآن "+f(now)+" د.ع لكل 100$").setAutoCancel(true);((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).notify(102,b.build());}

    String version(){try{return getPackageManager().getPackageInfo(getPackageName(),0).versionName;}catch(Exception e){return "1.0.1";}}
    static int cmp(String a,String b){String[]x=a.replace("v","").split("\\."),y=b.replace("v","").split("\\.");for(int i=0;i<Math.max(x.length,y.length);i++){int A=i<x.length?num(x[i]):0,B=i<y.length?num(y[i]):0;if(A!=B)return Integer.compare(A,B);}return 0;}
    static int num(String s){try{Matcher m=Pattern.compile("^\\d+").matcher(s);return m.find()?Integer.parseInt(m.group()):0;}catch(Exception e){return 0;}}
    static String f(int n){return n>0?new DecimalFormat("#,###").format(n):"—";}

    LinearLayout vbox(){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.VERTICAL);return l;}
    LinearLayout hbox(){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.HORIZONTAL);return l;}
    LinearLayout chip(int color){LinearLayout l=hbox();l.setGravity(Gravity.CENTER);l.setPadding(dp(10),0,dp(10),0);l.setBackground(bg(color,15,0,0));return l;}
    TextView tv(String s,int sp,int color,boolean bold){TextView t=new TextView(this);t.setText(s);t.setTextSize(sp);t.setTextColor(color);t.setTypeface(Typeface.create("sans",bold?Typeface.BOLD:Typeface.NORMAL));return t;}
    Button button(String s,int color){Button b=new Button(this);b.setText(s);b.setTextColor(Color.WHITE);b.setTextSize(11);b.setTypeface(Typeface.DEFAULT_BOLD);b.setAllCaps(false);b.setBackground(bg(color,14,0,0));return b;}
    View space(int h){Space s=new Space(this);s.setLayoutParams(new LinearLayout.LayoutParams(1,dp(h)));return s;}
    View spaceH(int w){Space s=new Space(this);s.setLayoutParams(new LinearLayout.LayoutParams(dp(w),1));return s;}
    GradientDrawable bg(int fill,int radius,int stroke,int sw){GradientDrawable g=new GradientDrawable();g.setColor(fill);g.setCornerRadius(dp(radius));if(sw>0)g.setStroke(dp(sw),stroke);return g;}
    int dp(int n){return (int)(n*getResources().getDisplayMetrics().density+.5f);} static int c(int r,int g,int b){return Color.rgb(r,g,b);}

    static class Market{int kBuy,kSell,hBuy,hSell,g18,g21,g24;long updated;int highSell(){return Math.max(kSell,hSell);}int highBuy(){return Math.max(kBuy,hBuy);}}
    static class UpdateInfo{String version="",url="",sha="",status="جاري فحص التحديث...";boolean available=false;}
}
