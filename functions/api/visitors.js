function j(data,status=200,headers={}){
  return new Response(JSON.stringify(data),{status,headers:{
    "content-type":"application/json; charset=utf-8",
    "cache-control":"no-store",
    ...headers
  }});
}

function hash(s){
  let h=2166136261;
  for(let i=0;i<s.length;i++){
    h^=s.charCodeAt(i);
    h=Math.imul(h,16777619);
  }
  return h>>>0;
}

function phNow(ts=Date.now()){
  const d=new Date(ts+8*3600000);
  return {
    day:d.toISOString().slice(0,10),
    h:d.getUTCHours(),
    m:d.getUTCMinutes(),
    s:d.getUTCSeconds(),
    ms:d.getUTCMilliseconds()
  };
}

export async function onRequestGet(){
  const t=phNow();
  const seed=hash(t.day);
  const seconds=t.h*3600+t.m*60+t.s+t.ms/1000;
  const progress=Math.max(0,Math.min(1,seconds/86400));

  // Visitors Today: always trends upward through the Manila day.
  // Starts in the 20k range and typically finishes around 60k-72k.
  const dayBase=22000+(seed%6500);
  const dailyGain=36500+((seed>>>7)%8000);
  const curve=Math.pow(progress,0.92);
  const today=Math.max(20000,Math.min(72000,
    Math.floor(dayBase+(dailyGain*curve))
  ));

  // Online Now: tied to traffic volume, but breathes up/down naturally.
  // Evening gets a small activity lift; late night/early morning cools down.
  const hour=t.h+t.m/60;
  const peakBoost=(hour>=17&&hour<23)?150:(hour<6? -120:35);
  const ratio=0.019+(((seed>>>16)%12)/1000);
  const wave1=Math.sin((seconds/34)+(seed%17))*125;
  const wave2=Math.sin((seconds/11)+((seed>>>8)%29))*58;
  const wave3=Math.sin((seconds/4.7)+((seed>>>4)%41))*24;
  const now=Math.max(650,Math.min(2100,
    Math.round(today*ratio+peakBoost+wave1+wave2+wave3)
  ));

  return j({
    ok:true,
    configured:true,
    today,
    now,
    active_window_minutes:5,
    timezone:"Asia/Manila",
    checked_at:new Date().toISOString(),
    source:"simulated",
    stale:false
  });
}
