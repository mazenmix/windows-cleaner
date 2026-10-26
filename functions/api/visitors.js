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
  const nowMs=Date.now();
  const t=phNow(nowMs);
  const seed=hash(t.day);
  const seconds=t.h*3600+t.m*60+t.s+t.ms/1000;

  // Simulated visitor total (NOT real analytics): never reset at midnight.
  // Match the original 2026-10-26 Manila daily counter exactly until its
  // first midnight, then keep adding at a stable 15,000-per-day pace.
  // A fixed UTC anchor also keeps totals consistent across devices and requests.
  const anchorMs=Date.UTC(2026,9,25,16,0,0); // 2026-10-26 00:00 Asia/Manila
  const anchorSeed=hash("2026-10-26");
  const anchorBase=70000+(anchorSeed%20001);
  const firstDayGain=12000+((anchorSeed>>>7)%7001);
  const elapsedSec=Math.max(0,(nowMs-anchorMs)/1000);
  const firstDaySec=Math.min(elapsedSec,86400);
  const afterFirstDaySec=Math.max(0,elapsedSec-86400);
  const today=Math.floor(
    anchorBase
    +firstDayGain*Math.pow(firstDaySec/86400,0.92)
    +afterFirstDaySec*(15000/86400)
  );

  // SIMULATED online visitors (not real-time analytics).
  // Tick by one every second so refreshing shows a new value.
  // Rise from 15,000 to 27,000, then gradually return to 15,000;
  // never leave the requested 13,000–27,000 range or jump at rollover.
  const onlineAnchorMs=Date.UTC(2026,9,26,18,23,48);
  const onlineElapsedSec=Math.max(0,Math.floor((nowMs-onlineAnchorMs)/1000));
  const onlinePhase=onlineElapsedSec%24000;
  const now=15000+(onlinePhase<=12000?onlinePhase:24000-onlinePhase);

  return j({
    ok:true,
    configured:true,
    today:today+115487,
    now,
    counter_mode:"cumulative",
    active_window_minutes:5,
    timezone:"Asia/Manila",
    checked_at:new Date().toISOString(),
    source:"simulated",
    stale:false
  });
}
