function j(data,status=200,headers={}){
  return new Response(JSON.stringify(data),{status,headers:{
    "content-type":"application/json; charset=utf-8",
    "cache-control":"no-store",
    ...headers
  }});
}

function cookieId(req){
  const raw=req.headers.get("cookie")||"";
  const m=raw.match(/(?:^|;\s*)mxvid=([a-zA-Z0-9_-]{12,80})/);
  return m?m[1]:null;
}

function phDay(ts=Date.now()){
  return new Date(ts+8*3600000).toISOString().slice(0,10);
}

function safeCount(v){
  const n=Number(v);
  return Number.isFinite(n)&&n>=0?Math.round(n):null;
}

async function counterHit(action,key,id,extra={}){
  const ns="mxfuel.pages.dev";
  const url=new URL(
    "https://counterapi.com/api/"+
    encodeURIComponent(ns)+"/"+
    encodeURIComponent(action)+"/"+
    encodeURIComponent(key)
  );
  url.searchParams.set("unique","true");
  url.searchParams.set("userId",id);
  url.searchParams.set("noFormatting","true");
  for(const [k,v] of Object.entries(extra))url.searchParams.set(k,String(v));

  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),6500);
  try{
    const r=await fetch(url.toString(),{
      method:"GET",
      headers:{"accept":"application/json"},
      signal:ctrl.signal,
      cf:{cacheTtl:0,cacheEverything:false}
    });
    if(!r.ok)throw new Error("CounterAPI HTTP "+r.status);
    const data=await r.json();
    const value=safeCount(data?.value);
    if(value===null)throw new Error("CounterAPI invalid value");
    return value;
  }finally{
    clearTimeout(timer);
  }
}

function cacheRequest(){
  return new Request("https://mxfuel.pages.dev/__mx_visitors_last_verified",{method:"GET"});
}

async function readSnapshot(){
  try{
    if(typeof caches==="undefined"||!caches.default)return null;
    const r=await caches.default.match(cacheRequest());
    if(!r)return null;
    const x=await r.json();
    if(safeCount(x?.today)===null||safeCount(x?.now)===null)return null;
    return x;
  }catch(e){return null}
}

async function saveSnapshot(context,data){
  try{
    if(typeof caches==="undefined"||!caches.default)return;
    const r=new Response(JSON.stringify(data),{headers:{
      "content-type":"application/json; charset=utf-8",
      "cache-control":"public, max-age=86400"
    }});
    const p=caches.default.put(cacheRequest(),r);
    if(context?.waitUntil)context.waitUntil(p);else await p;
  }catch(e){}
}

export async function onRequestGet(context){
  const req=context.request;
  let id=cookieId(req),setCookie=null;
  if(!id){
    id=crypto.randomUUID().replace(/-/g,"");
    setCookie="mxvid="+id+"; Max-Age=31536000; Path=/; SameSite=Lax; Secure";
  }

  const day=phDay();
  try{
    // Real unique browsers for the current Manila calendar day.
    // Repeated refreshes from the same mxvid do not inflate the unique count.
    const [today,now]=await Promise.all([
      counterHit("visit-day",day,id),
      // A heartbeat on every frontend refresh; timeline keeps only users active in the last 5 minutes.
      counterHit("presence","site",id,{timeline:"5m"})
    ]);

    const out={
      ok:true,
      configured:true,
      today,
      now,
      active_window_minutes:5,
      timezone:"Asia/Manila",
      checked_at:new Date().toISOString(),
      source:"counterapi",
      stale:false
    };
    await saveSnapshot(context,out);
    return j(out,200,setCookie?{"set-cookie":setCookie}:{});
  }catch(e){
    const cached=await readSnapshot();
    if(cached){
      return j({
        ...cached,
        ok:true,
        configured:true,
        stale:true,
        source:"last-verified-cache",
        checked_at:new Date().toISOString()
      },200,setCookie?{"set-cookie":setCookie}:{});
    }
    return j({
      ok:false,
      configured:false,
      error:"Visitor counter source temporarily unavailable",
      checked_at:new Date().toISOString()
    },503,setCookie?{"set-cookie":setCookie}:{});
  }
}
