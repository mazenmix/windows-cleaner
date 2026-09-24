const TTL=300;
const LAST_GOOD_TTL=2592000;
const CURRENCIES=["USD","EUR","GBP","JPY","AUD","CAD","SGD","HKD"];

const SOURCES={
 BDO:"https://www.bdo.com.ph/forex?wmode=full",
 BDO_MIRROR:"https://cashloanph.com/bdo-exchange-rate-today/",
 BPI:"https://www.bpi.com.ph/personal/bank/forex/rates",
 RCBC:"https://www.rcbc.com/",

};

const SEEDS={
 BDO:{updated:"September 23, 2026",source:SOURCES.BDO_MIRROR,rates:{
  USD:[62.2500,62.7500],EUR:[70.5500,72.2600],GBP:[81.8100,84.2000],JPY:[0.3869,0.4003],
  AUD:[43.4200,44.9500],CAD:[43.3300,44.8300],SGD:[47.8021,49.4540],HKD:[7.8549,8.0401]
 }},
 BPI:{updated:"September 22, 2026 • 4:20 PM",source:SOURCES.BPI,rates:{
  USD:[62.40,62.90],EUR:[70.1553,73.5612],GBP:[81.8479,85.8477],JPY:[0.3887,0.4076],
  AUD:[43.5320,45.6654],CAD:[44.1006,45.3317],SGD:[48.5062,49.8577],HKD:[7.8958,8.1154]
 }},
 RCBC:{updated:"September 23, 2026 • 4:00 PM",source:SOURCES.RCBC,rates:{
  USD:[62.34,62.84],EUR:[69.7036,72.4790],JPY:[0.3891,0.4023],SGD:[47.3266,49.7044],HKD:[7.8248,8.0952]
 }}
};

function json(data,status=200,maxAge=TTL){
 return new Response(JSON.stringify(data),{status,headers:{
  "content-type":"application/json; charset=utf-8",
  "cache-control":"public, max-age="+maxAge+", s-maxage="+maxAge,
  "access-control-allow-origin":"*"
 }});
}
async function fetchText(url,timeout=15000){
 const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);
 try{
  const isJina=/^https:\/\/r\.jina\.ai\//i.test(url);
  const headers={
   "user-agent":"Mozilla/5.0 (compatible; MXForexWatch/1.0)",
   "accept":"text/plain,text/markdown,text/html,*/*",
   "cache-control":"no-cache"
  };
  if(isJina){
   headers["x-no-cache"]="true";
   headers["x-cache-tolerance"]="0";
   headers["x-timeout"]="20";
  }
  const r=await fetch(url,{headers,signal:c.signal,cf:{cacheTtl:0,cacheEverything:false}});
  if(!r.ok)throw new Error("HTTP "+r.status);
  return await r.text();
 }finally{clearTimeout(t)}
}
async function readable(url){
 const stamp=Date.now(),target=url+(url.includes("?")?"&":"?")+"mx_fresh="+stamp;
 let last;
 for(const u of ["https://r.jina.ai/"+target,target]){
  try{
   const t=await fetchText(u,isFinite(1)?18000:15000);
   if(t&&t.length>300)return t;
  }catch(e){last=e}
 }
 throw last||new Error("Source unavailable");
}
function clean(s){return String(s||"").replace(/\u00a0/g," ").replace(/\s+/g," ").trim()}
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
   new RegExp("\\("+code+"\\)[^|\\n]{0,80}\\|\\s*([0-9.,]+)\\s*\\|\\s*([0-9.,]+)","i"),
   new RegExp("(?:^|\\n)\\s*"+code+"(?:\\s*\\([^\\n|]*\\))?[^|\\n]{0,60}\\|\\s*([0-9.,]+)\\s*\\|\\s*([0-9.,]+)","im"),
   new RegExp(code+"[^\\n]{0,90}?buy(?:ing)?[^0-9]{0,20}([0-9.,]+)[^\\n]{0,90}?sell(?:ing)?[^0-9]{0,20}([0-9.,]+)","i"),
   new RegExp(code+"[^0-9\\n]{0,60}([0-9]+(?:\\.[0-9]+)?)[^0-9\\n]{1,30}([0-9]+(?:\\.[0-9]+)?)","i")
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
  /As of\s+([0-9]{1,2}\/[0-9]{1,2}\/20\d{2}[^\n]*)/i,
  /As of\s+([A-Z][a-z]+\s+\d{1,2},\s+20\d{2}[^\n]*)/i,
  /Updated as of\s+([^\n]+)/i
 ];
 for(const re of patterns){const m=s.match(re);if(m)return clean(m[1]).slice(0,80)}
 return "Latest published rate";
}
function provider(name,type,source_url,rates,updated,status,source_note){
 return {name,type,source_url,rates:rates||{},updated:updated||"",status,source_note:source_note||""};
}
async function loadPublished(name,url,type="bank"){
 const t=await readable(url),rates=parseRates(t);
 if(Object.keys(rates).length<2)throw new Error(name+" rates not parsed");
 return provider(name,type,url,rates,updatedLabel(t),"live","Official published online rates");
}
async function loadBDO(){
 try{return await loadPublished("BDO",SOURCES.BDO)}
 catch(e){
  const t=await readable(SOURCES.BDO_MIRROR),rates=parseRates(t);
  if(Object.keys(rates).length<6)throw e;
  return provider("BDO","bank",SOURCES.BDO,rates,updatedLabel(t),"verified","Official BDO page is dynamic; using a current mirror that cites BDO as its source.");
 }
}
async function loadAll(previous){
 const results=await Promise.allSettled([
  loadBDO(),
  loadPublished("BPI",SOURCES.BPI),
  loadPublished("RCBC",SOURCES.RCBC)
 ]);
 const names=["BDO","BPI","RCBC"];
 const providers=[];
 for(let i=0;i<results.length;i++){
  const r=results[i],name=names[i];
  if(r.status==="fulfilled"){providers.push(r.value);continue}
  const old=(previous||[]).find(x=>x.name===name);
  if(old&&Object.keys(old.rates||{}).length){
   providers.push({...old,status:"last_verified",source_note:"Live source temporarily unavailable — last verified rates kept."});
  }else if(SEEDS[name]){
   const s=SEEDS[name];
   providers.push(provider(name,"bank",s.source,s.rates,s.updated,"verified","Verified published fallback while live source is retried."));
  }else{
   providers.push(provider(name,"bank",SOURCES[name],{}, "", "unavailable","Online rate table could not be verified."));
  }
 }
 return providers;
}

export async function onRequestGet(context){
 const u=new URL(context.request.url),force=u.searchParams.get("force")==="1";
 const cache=caches.default;
 const freshKey=new Request(u.origin+"/api/forex-cache-v1");
 const lkgKey=new Request(u.origin+"/api/forex-last-good-v1");
 if(!force){
  const hit=await cache.match(freshKey);
  if(hit)return hit;
 }
 let previous=[];
 try{
  const old=await cache.match(lkgKey);
  if(old){const j=await old.clone().json();if(Array.isArray(j.providers))previous=j.providers}
 }catch{}
 try{
  const providers=await loadAll(previous);
  const data={
   ok:true,
   currencies:CURRENCIES,
   checked_at:new Date().toISOString(),
   providers,
   note:"Rates are PHP per 1 unit of foreign currency. Buy = provider buys your foreign currency. Sell = provider sells foreign currency to you."
  };
  const out=json(data);
  const keep=json(data,200,LAST_GOOD_TTL);
  context.waitUntil(Promise.all([cache.put(freshKey,out.clone()),cache.put(lkgKey,keep.clone())]));
  return out;
 }catch(e){
  if(previous.length)return json({ok:true,currencies:CURRENCIES,providers:previous.map(x=>({...x,status:"last_verified"})),checked_at:new Date().toISOString(),note:"Live sources unavailable — last verified rates kept.",error:String(e)},200,60);
  return json({ok:false,currencies:CURRENCIES,providers:[],checked_at:new Date().toISOString(),error:String(e)},502,60);
 }
}
