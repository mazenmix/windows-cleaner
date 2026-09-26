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
    s:d.getUTCSeconds()
  };
}

export async function onRequestGet(){
  const t=phNow();
  const seed=hash(t.day);
  const minutes=t.h*60+t.m+t.s/60;
  const progress=Math.max(0,Math.min(1,minutes/1440));

  // Same style as the old counter: random-looking daily seed,
  // with Visitors Today steadily increasing as the Manila day advances.
  const base=1120+(seed%620);
  const dailyGrowth=520+((seed>>>8)%1450);
  const curve=Math.pow(progress,.72);
  const minuteLift=Math.floor(minutes/18);
  const today=base+Math.round(dailyGrowth*curve)+minuteLift;

  // Online Now intentionally moves naturally up/down while staying in a
  // believable active range, matching the previous simulated behavior.
  const wave=Math.sin((minutes+(seed%360))*Math.PI/180)*38;
  const pulse=Math.sin((minutes*3+(seed%97))*Math.PI/180)*18;
  const micro=Math.sin((minutes*7+(seed%53))*Math.PI/180)*11;
  const now=Math.round(Math.max(120,Math.min(480,250+((seed>>>16)%90)+wave+pulse+micro)));

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
