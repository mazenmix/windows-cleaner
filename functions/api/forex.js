const TTL=60;
const LAST_GOOD_TTL=2592000;
const CURRENCIES=["USD","EUR","GBP","JPY","AUD","CAD","SGD","HKD"];

const SOURCES={
 BDO:"https://www.bdo.com.ph/forex?wmode=full",
 BPI:"https://www.bpi.com.ph/personal/bank/forex/rates",
 RCBC:"https://www.rcbc.com/"
};

function json(data,status=200,maxAge=TTL){
 return new Response(JSON.stringify(data),{status,headers:{
  "content-type":"application/json; charset=utf-8",
  "cache-control":"public, max-age="+maxAge+", s-maxage="+maxAge,
  "access-control-allow-origin":"*"
 }});
}

async function fetchText(url,timeout=18000){
 const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);
 try{
  const headers={
   "user-agent":"Mozilla/5.0 (compatible; MXForexWatch/2.0)",
   "accept":"text/plain,text/markdown,text/html,*/*",
   "cache-control":"no-cache, no-store",
   "pragma":"no-cache"
  };
  const r=await fetch(url,{
   headers,
   signal:c.signal,
   cf:{cacheTtl:0,cacheEverything:false}
  });
  if(!r.ok)throw new Error("HTTP "+r.status);
  return await r.text();
 }finally{clearTimeout(t)}
}

function withFreshParam(url){
 const u=new URL(url);
 u.searchParams.set("mx_fresh",String(Date.now()));
 return u.toString();
}

async function readable(url){
 const target=withFreshParam(url);
 let last;
 // Prefer the official page directly. Jina is only a readability fallback,
 // never a data source of its own.
 for(const u of [target,"https://r.jina.ai/"+target]){
  try{
   const t=await fetchText(u);
   if(t&&t.length>300)return t;
  }catch(e){last=e}
 }
 throw last||new Error("Source unavailable");
}

function clean(s){
 return String(s||"").replace(/\u00a0/g," ").replace(/\s+/g," ").trim();
}

function num(v){
 const n=Number(String(v||"").replace(/[,₱PHP\s]/gi,""));
 return Number.isFinite(n)&&n>0&&n<100000?n:null;
}

function pair(buy,sell){
 const b=num(buy),s=num(sell);
 return b&&s&&s>=b?[b,s]:null;
}

function parseRates(text){
 const out={};
 const src=String(text||"");
 for(const code of CURRENCIES){
  const patterns=[
   new RegExp("\\("+code+"\\)[^|\\n]{0,100}\\|\\s*([0-9.,]+)\\s*\\|\\s*([0-9.,]+)","i"),
   new RegExp("(?:^|\\n)\\s*"+code+"(?:\\s*\\([^\\n|]*\\))?[^|\\n]{0,80}\\|\\s*([0-9.,]+)\\s*\\|\\s*([0-9.,]+)","im"),
   new RegExp(code+"[^\\n]{0,100}?buy(?:ing)?[^0-9]{0,24}([0-9.,]+)[^\\n]{0,100}?sell(?:ing)?[^0-9]{0,24}([0-9.,]+)","i"),
   new RegExp(code+"[^0-9\\n]{0,80}([0-9]+(?:\\.[0-9]+)?)[^0-9\\n]{1,40}([0-9]+(?:\\.[0-9]+)?)","i")
  ];
  for(const re of patterns){
   const m=src.match(re);
   if(!m)continue;
   const p=pair(m[1],m[2]);
   if(p){out[code]=p;break}
  }
 }
 return out;
}

function updatedLabel(text){
 const s=String(text||"");
 const patterns=[
  /Indicative Foreign Exchange Rate as of\s+([^\n]+)/i,
  /Updated as of\s+([^\n]+)/i,
  /As of\s+([0-9]{1,2}\/[0-9]{1,2}\/20\d{2}(?:\s+\d{1,2}:\d{2}\s*(?:AM|PM)?)?)/i,
  /As of\s+(\d{1,2}:\d{2}\s*(?:AM|PM),\s*[A-Z][a-z]+\s+\d{1,2},\s+20\d{2})/i,
  /As of\s+([A-Z][a-z]+\s+\d{1,2},\s+20\d{2}(?:[^\n]*)?)/i
 ];
 for(const re of patterns){
  const m=s.match(re);
  if(m)return clean(m[1]).slice(0,100);
 }
 return "Latest published rate";
}

function provider(name,type,source_url,rates,updated,status,source_note,fetched_at){
 return {
  name,
  type,
  source_url,
  rates:rates||{},
  updated:updated||"",
  status,
  source_note:source_note||"",
  fetched_at:fetched_at||""
 };
}

async function loadPublished(name,url,type="bank"){
 const t=await readable(url);
 const rates=parseRates(t);
 if(Object.keys(rates).length<2)throw new Error(name+" rates not parsed");
 return provider(
  name,
  type,
  url,
  rates,
  updatedLabel(t),
  "live",
  "Official published online rates",
  new Date().toISOString()
 );
}

async function loadAll(previous){
 const jobs=[
  ["BDO",SOURCES.BDO],
  ["BPI",SOURCES.BPI],
  ["RCBC",SOURCES.RCBC]
 ];
 const results=await Promise.allSettled(jobs.map(([name,url])=>loadPublished(name,url)));
 const providers=[];

 for(let i=0;i<results.length;i++){
  const [name,url]=jobs[i];
  const r=results[i];
  if(r.status==="fulfilled"){
   providers.push(r.value);
   continue;
  }

  const old=(previous||[]).find(x=>x.name===name&&Object.keys(x.rates||{}).length);
  if(old){
   providers.push({
    ...old,
    status:"last_verified",
    source_url:url,
    source_note:"Official source temporarily unavailable — showing the last rate previously fetched from that official source."
   });
  }else{
   providers.push(provider(
    name,
    "bank",
    url,
    {},
    "",
    "unavailable",
    "Official online rate table could not be verified. No seeded or invented rate is shown."
   ));
  }
 }

 return providers;
}

export async function onRequestGet(context){
 const u=new URL(context.request.url);
 const force=u.searchParams.get("force")==="1";
 const cache=caches.default;

 // V2 keys deliberately invalidate the old cache that contained seeded rates.
 const freshKey=new Request(u.origin+"/api/forex-cache-v2");
 const lkgKey=new Request(u.origin+"/api/forex-last-good-v2");

 if(!force){
  const hit=await cache.match(freshKey);
  if(hit)return hit;
 }

 let previous=[];
 try{
  const old=await cache.match(lkgKey);
  if(old){
   const j=await old.clone().json();
   if(Array.isArray(j.providers))previous=j.providers;
  }
 }catch{}

 try{
  const providers=await loadAll(previous);
  const usable=providers.some(p=>Object.keys(p.rates||{}).length);
  if(!usable)throw new Error("No verified forex data available");

  const checkedAt=new Date().toISOString();
  const liveCount=providers.filter(p=>p.status==="live").length;
  const data={
   ok:true,
   currencies:CURRENCIES,
   checked_at:checkedAt,
   live_count:liveCount,
   providers,
   note:"Rates come from each provider's official published online source. No static seed values are used."
  };

  const out=json(data);
  const keep=json(data,200,LAST_GOOD_TTL);
  context.waitUntil(Promise.all([
   cache.put(freshKey,out.clone()),
   cache.put(lkgKey,keep.clone())
  ]));
  return out;

 }catch(e){
  if(previous.length){
   return json({
    ok:true,
    currencies:CURRENCIES,
    providers:previous.map(x=>({...x,status:"last_verified"})),
    checked_at:new Date().toISOString(),
    live_count:0,
    note:"Official sources were checked but are temporarily unavailable — last genuinely fetched rates are retained.",
    error:String(e)
   },200,30);
  }

  return json({
   ok:false,
   currencies:CURRENCIES,
   providers:[],
   checked_at:new Date().toISOString(),
   live_count:0,
   note:"No static fallback is allowed.",
   error:String(e)
  },502,30);
 }
}
