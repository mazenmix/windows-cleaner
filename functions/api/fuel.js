const FRESH_TTL=60;
const LAST_GOOD_TTL=2592000;
const SOURCE="https://gaswatchph.com/";
const JINA=["https://r.jina.ai/https://gaswatchph.com/","https://r.jina.ai/http://gaswatchph.com/"];

const FALLBACK_FUEL=[
{name:"Shell",stations:204,diesel:[105.73,7.80],premDiesel:[112.94,7.80],unleaded91:[93.68,4.80],eGas:null,prem95:[100.93,4.80],prem97:[107.21,4.80],kerosene:[132.85,6.40]},
{name:"Petron",stations:240,diesel:[104.19,7.77],premDiesel:[107.22,7.80],unleaded91:[91.73,4.75],eGas:null,prem95:[92.75,4.77],prem97:[101.83,4.80],kerosene:[129.58,6.40]},
{name:"Caltex",stations:131,diesel:[107.43,7.82],premDiesel:[111.69,7.82],unleaded91:[94.63,4.88],eGas:null,prem95:[101.83,4.88],prem97:[104.60,4.88],kerosene:[128.43,6.47]},
{name:"Phoenix",stations:70,diesel:[108.35,7.82],premDiesel:null,unleaded91:[99.44,4.88],eGas:[105.38,4.88],prem95:[101.45,4.88],prem97:[104.85,4.88],kerosene:null},
{name:"Seaoil",stations:71,diesel:[104.20,7.82],premDiesel:[110.23,7.82],unleaded91:[91.21,4.88],eGas:[117.06,4.88],prem95:[94.22,4.88],prem97:[94.78,4.88],kerosene:[134.56,6.47]},
{name:"Unioil",stations:83,diesel:[103.26,7.60],premDiesel:null,unleaded91:[90.28,4.66],eGas:[114.28,4.80],prem95:[93.31,4.69],prem97:[108.99,4.80],kerosene:null},
{name:"Jetti",stations:10,diesel:[104.91,6.80],premDiesel:null,unleaded91:[92.59,4.80],eGas:null,prem95:[96.51,4.80],prem97:[103.70,4.80],kerosene:null},
{name:"Flying V",stations:38,diesel:[100.73,7.80],premDiesel:null,unleaded91:[86.84,4.80],eGas:null,prem95:[87.79,4.80],prem97:null,kerosene:null},
{name:"Cleanfuel",stations:54,diesel:[104.82,7.82],premDiesel:null,unleaded91:[92.49,4.88],eGas:null,prem95:[96.51,4.88],prem97:null,kerosene:null},
{name:"Total",stations:41,diesel:[104.54,7.82],premDiesel:[111.88,7.82],unleaded91:[94.08,4.88],eGas:null,prem95:[95.40,4.88],prem97:[103.70,4.88],kerosene:null},
{name:"PTT",stations:22,diesel:[100.13,7.82],premDiesel:[103.51,7.82],unleaded91:[89.59,4.88],eGas:null,prem95:[90.44,4.88],prem97:null,kerosene:null}
];
const FALLBACK_LPG=[
{name:"Regasco",price:1229},{name:"Solane",price:1266},{name:"Petron Gasul",price:1291},
{name:"SL Gas",price:1319},{name:"Phoenix LPG",price:1334},{name:"Total Gas",price:1636}
];

function response(data,status=200,maxAge=FRESH_TTL){
 return new Response(JSON.stringify(data),{status,headers:{
  "content-type":"application/json; charset=utf-8",
  "cache-control":"public, max-age="+maxAge+", s-maxage="+maxAge,
  "access-control-allow-origin":"*"
 }});
}
async function fetchText(url,timeout=18000){
 const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);
 try{
  const isJina=/^https:\/\/r\.jina\.ai\//i.test(url);
  const headers={
   "user-agent":"Mozilla/5.0 (compatible; MXFuelWatch/3.0)",
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
async function sourceTexts(){
 const stamp=Date.now();
 const targets=[
  "https://r.jina.ai/https://gaswatchph.com/?mx_fresh="+stamp,
  "https://r.jina.ai/http://gaswatchph.com/?mx_fresh="+stamp,
  ...JINA,
  SOURCE+"?mx_fresh="+stamp
 ];
 const out=[];
 let last;
 for(let round=0;round<2;round++){
  for(const u of targets){
   try{
    const t=await fetchText(u,round===0?18000:22000);
    if(t&&t.length>800)out.push({url:u,text:t});
    // The full rendered brand table is the preferred source. Stop as soon as it parses.
    if(parseFuel(t).length>=8)return out;
   }catch(e){last=e}
  }
  await new Promise(r=>setTimeout(r,650*(round+1)));
 }
 if(out.length)return out;
 throw last||new Error("GasWatch source unavailable");
}
function priceCell(v){
 const s=String(v||"").trim();
 if(!s||/N\/A/i.test(s))return null;
 const m=s.match(/([0-9]+(?:\.[0-9]+)?)\s*([↑↓])?\s*([+-]?[0-9]+(?:\.[0-9]+)?)?/);
 if(!m)return null;
 let d=m[3]?Number(m[3]):0;
 if(m[2]==="↓"&&d>0)d=-d;
 return [Number(m[1]),Number.isFinite(d)?d:0];
}
function parseFuel(text){
 const names=new Set(FALLBACK_FUEL.map(x=>x.name));
 const out=[];
 for(const line of String(text||"").split(/\r?\n/)){
  if(!line.includes("|"))continue;
  let p=line.split("|").map(x=>x.trim()).filter((x,i,a)=>!(i===0&&x==="")&&!(i===a.length-1&&x===""));
  if(p.length<9||!names.has(p[0]))continue;
  out.push({
   name:p[0],stations:parseInt(p[1],10)||0,
   diesel:priceCell(p[2]),premDiesel:priceCell(p[3]),unleaded91:priceCell(p[4]),
   eGas:priceCell(p[5]),prem95:priceCell(p[6]),prem97:priceCell(p[7]),kerosene:priceCell(p[8])
  });
 }
 const seen=new Set();
 const rows=out.filter(x=>!seen.has(x.name)&&seen.add(x.name));
 return rows.length>=8?rows:[];
}
function mergeSnapshotFuel(text,baseRows){
 const src=String(text||"");
 const section=(src.match(/Metro Manila diesel and unleaded prices by brand[\\s\\S]{0,5000}/i)||[])[0]||src;
 const names=FALLBACK_FUEL.map(x=>x.name);
 const rows=[];
 for(const name of names){
  const esc=name.replace(/[.*+?^$()|[\\]\\\\{}]/g,"\\\\function parseLpg(text){");
  const m=section.match(new RegExp("(?:^|\\n)\\s*"+esc+"\\s*\\|\\s*([0-9]+(?:\\.[0-9]+)?)\\s*\\|\\s*([0-9]+(?:\\.[0-9]+)?)","im"));
  if(m)rows.push({name,diesel:Number(m[1]),unleaded:Number(m[2])});
 }
 if(rows.length<8)return [];
 const base=new Map((baseRows&&baseRows.length?baseRows:FALLBACK_FUEL).map(x=>[x.name,x]));
 return rows.map(x=>{
  const old=base.get(x.name)||FALLBACK_FUEL.find(y=>y.name===x.name);
  const copy=JSON.parse(JSON.stringify(old));
  const dieselDelta=old&&old.diesel&&Number.isFinite(old.diesel[0])?x.diesel-old.diesel[0]:0;
  const gasDelta=old&&old.unleaded91&&Number.isFinite(old.unleaded91[0])?x.unleaded-old.unleaded91[0]:0;
  copy.diesel=[x.diesel,dieselDelta];
  copy.unleaded91=[x.unleaded,gasDelta];
  return copy;
 });
}
async function readJsonResponse(r){
 try{return await r.clone().json()}catch(e){return null}
}
async function buildLiveData(previousFuel){
 const sources=await sourceTexts();
 let lastErr=null;
 for(const src of sources){
  try{
   const fuel=parseFuel(src.text);
   if(fuel.length>=8){
    return {fuel,lpg:parseLpg(src.text),updated:parseUpdated(src.text),source_url:src.url,partial:false};
   }
  }catch(e){lastErr=e}
 }
 throw lastErr||new Error("GasWatch dynamic price table not available yet");
}

function parseLpg(text){
 const section=(String(text||"").split(/## Gasul \/ LPG Prices/i)[1]||"").split(/## How We Track Prices/i)[0]||"";
 return FALLBACK_LPG.map(x=>{
  const esc=x.name.replace(/[.*+?^$()|[\]\\{}]/g,"\\$&");
  const m=section.match(new RegExp("(?:^|\\n)"+esc+"\\s*\\n\\s*(?:PHP|₱)\\s*([0-9,]+)","i"));
  return m?{name:x.name,price:Number(m[1].replace(/,/g,""))}:x;
 });
}
function parseUpdated(text){
 const m=String(text||"").match(/Prices updated\s+([^\n]+)/i)
   ||String(text||"").match(/As of\s+([A-Z][a-z]+\s+\d{1,2},\s+20\d{2})/i);
 return m?m[1].trim():"September 22, 2026";
}
export async function onRequestGet(context){
 const u=new URL(context.request.url),force=u.searchParams.get("force")==="1";
 const cache=caches.default;
 const freshKey=new Request(u.origin+"/api/fuel-cache-v3");
 const lkgKey=new Request(u.origin+"/api/fuel-last-good-v3");

 if(!force){
  const hit=await cache.match(freshKey);
  if(hit)return hit;
 }

 let previousFuel=FALLBACK_FUEL;
 const previous=await cache.match(lkgKey);
 if(previous){
  const pj=await readJsonResponse(previous);
  if(pj&&Array.isArray(pj.fuel)&&pj.fuel.length>=8)previousFuel=pj.fuel;
 }

 try{
  const live=await buildLiveData(previousFuel);
  const data={
   ok:true,
   fallback:false,
   stale:false,
   partial:!!live.partial,
   source:"GasWatch PH",
   source_url:SOURCE,
   transport:live.source_url,
   updated:live.updated,
   checked_at:new Date().toISOString(),
   fuel:live.fuel,
   lpg:live.lpg,
   note:live.partial
    ?"Live GasWatch snapshot loaded; fields not exposed by the current source layout keep their last verified values."
    :"Live GasWatch data loaded."
  };
  const fresh=response(data,200,FRESH_TTL);
  const keep=response(data,200,LAST_GOOD_TTL);
  context.waitUntil(Promise.all([
   cache.put(freshKey,fresh.clone()),
   cache.put(lkgKey,keep.clone())
  ]));
  return fresh;
 }catch(e){
  const last=await cache.match(lkgKey);
  if(last){
   const j=await readJsonResponse(last);
   if(j&&Array.isArray(j.fuel)&&j.fuel.length>=8){
    return response({
     ...j,
     ok:true,
     fallback:true,
     stale:true,
     checked_at:new Date().toISOString(),
     note:"Live source temporarily unavailable — last verified prices kept automatically.",
     error:String(e)
    },200,60);
   }
  }
  return response({
   ok:true,
   fallback:true,
   stale:true,
   partial:true,
   source:"GasWatch PH",
   source_url:SOURCE,
   updated:"September 22, 2026",
   checked_at:new Date().toISOString(),
   fuel:FALLBACK_FUEL,
   lpg:FALLBACK_LPG,
   note:"Live source unavailable and no cached verified copy exists yet; safe built-in snapshot shown.",
   error:String(e)
  },200,60);
 }
}
