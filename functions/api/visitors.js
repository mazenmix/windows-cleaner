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

  // Visitors Today is a SIMULATED counter, not measured traffic.
  // The seed changes at 00:00 Asia/Manila, with a +10,000 baseline
  // each new calendar month starting October 2026.
  const [year,month]=t.day.split("-").map(Number);
  const monthsSinceStart=Math.max(0,(year-2026)*12+(month-10));
  const monthlyLift=monthsSinceStart*10000;
  const dayBase=70000+(seed%20001)+monthlyLift;
  const dailyGain=12000+((seed>>>7)%7001);
  const curve=Math.pow(progress,0.92);
  const today=Math.floor(dayBase+(dailyGain*curve));

  // SIMULATED concurrent visitors: a 3,000–8,000 range alongside
  // Visitors Today, not a measurement of real connected users.
  // Activity is usually higher in the Manila afternoon/evening and
  // changes smoothly instead of jumping several times a second.
  const hour=t.h+t.m/60+t.s/3600;
  const ManilaPeak=0.5+0.5*Math.cos((hour-17)*Math.PI/12);
  const dayVariation=((seed>>>11)%701)-350;
  const visitorLift=Math.min(650,Math.max(0,(today-70000)*0.01));
  const wave1=Math.sin((seconds/410)+(seed%17))*110;
  const wave2=Math.sin((seconds/137)+((seed>>>8)%29))*55;
  const now=Math.max(3000,Math.min(8000,
    Math.round(3650+3100*ManilaPeak+dayVariation+visitorLift+wave1+wave2)
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
