const FRESH_TTL=60;
const LAST_GOOD_TTL=2592000;
const SOURCE="https://gaswatchph.com/";
const JINA=["https://r.jina.ai/https://gaswatchph.com/","https://r.jina.ai/http://gaswatchph.com/"];

const FUEL_BRANDS=["Shell","Petron","Caltex","Phoenix","Seaoil","Unioil","Jetti","Flying V","Cleanfuel","Total","PTT"];
const LPG_BRANDS=["Regasco","Solane","Petron Gasul","SL Gas","Phoenix LPG","Total Gas"];

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
    // Prefer a render that contains both the full fuel table and the LPG section.
    if(parseFuel(t).length>=8&&parseLpgLive(t).length>=4)return out;
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
 const names=new Set(FUEL_BRANDS);
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
async function readJsonResponse(r){
 try{return await r.clone().json()}catch(e){return null}
}
async function buildLiveData(previousFuel,previousLpg){
 const sources=await sourceTexts();
 let lastErr=null,bestFuelOnly=null;
 for(const src of sources){
  try{
   const fuel=parseFuel(src.text);
   if(fuel.length>=8){
    const liveLpg=parseLpgLive(src.text);
    const candidate={
     fuel,
     lpg:mergeLpg(liveLpg,previousLpg),
     lpg_live:liveLpg.length>=4,
     lpg_live_count:liveLpg.length,
     updated:parseUpdated(src.text),
     source_url:src.url,
     partial:false
    };
    if(candidate.lpg_live)return candidate;
    if(!bestFuelOnly)bestFuelOnly=candidate;
   }
  }catch(e){lastErr=e}
 }
 if(bestFuelOnly)return bestFuelOnly;
 throw lastErr||new Error("GasWatch dynamic price table not available yet");
}

function parseLpgLive(text){
 const src=String(text||"");
 const section=(src.split(/## Gasul \/ LPG Prices/i)[1]||src).split(/## How We Track Prices/i)[0]||"";
 const out=[];
 for(const name of LPG_BRANDS){
  const esc=name.replace(/[.*+?^$()|[\]\\{}]/g,"\\ for(const x of FALLBACK_LPG){
  const esc=x.name.replace(/[.*+?^$()|[\]\\{}]/g,"\\$&");");
  const patterns=[
   new RegExp("(?:^|\\n)\\s*"+esc+"\\s*\\n\\s*(?:PHP|₱)\\s*([0-9,]+)","i"),
   new RegExp("(?:^|\\n)\\s*"+esc+"\\s*\\|\\s*(?:PHP|₱)?\\s*([0-9,]+)","i"),
   new RegExp(esc+"[^0-9]{0,80}(?:PHP|₱)?\\s*([0-9]{3,5})","i")
  ];
  let m=null;
  for(const re of patterns){m=section.match(re);if(m)break}
  if(m){
   const price=Number(m[1].replace(/,/g,""));
   if(Number.isFinite(price)&&price>100&&price<10000)out.push({name,price});
  }
 }
 return out;
}
function mergeLpg(live,previous){
 const base=new Map();
 for(const x of Array.isArray(previous)?previous:[]){
  if(x&&x.name&&Number.isFinite(Number(x.price)))base.set(x.name,{name:x.name,price:Number(x.price)});
 }
 for(const x of live||[]){
  if(x&&x.name&&Number.isFinite(Number(x.price)))base.set(x.name,{name:x.name,price:Number(x.price)});
 }
 return LPG_BRANDS.map(name=>base.get(name)).filter(Boolean);
}
function parseUpdated(text){
 const m=String(text||"").match(/Prices updated\s+([^\n]+)/i)
   ||String(text||"").match(/As of\s+([A-Z][a-z]+\s+\d{1,2},\s+20\d{2})/i);
 return m?m[1].trim():"Latest source update";
}
export async function onRequestGet(context){
 const u=new URL(context.request.url),force=u.searchParams.get("force")==="1";
 const cache=caches.default;
 const freshKey=new Request(u.origin+"/api/fuel-cache-v4");
 const lkgKey=new Request(u.origin+"/api/fuel-last-good-v4");

 if(!force){
  const hit=await cache.match(freshKey);
  if(hit)return hit;
 }

 let previousFuel=[];
 let previousLpg=[];
 const previous=await cache.match(lkgKey);
 if(previous){
  const pj=await readJsonResponse(previous);
  if(pj&&Array.isArray(pj.fuel)&&pj.fuel.length>=8)previousFuel=pj.fuel;
  if(pj&&Array.isArray(pj.lpg)&&pj.lpg.length)previousLpg=pj.lpg;
 }

 try{
  const live=await buildLiveData(previousFuel,previousLpg);
  const data={
   ok:true,
   fallback:false,
   stale:false,
   partial:!!live.partial,
   lpg_live:!!live.lpg_live,
   lpg_stale:!live.lpg_live,
   lpg_live_count:live.lpg_live_count||0,
   source:"GasWatch PH",
   source_url:SOURCE,
   transport:live.source_url,
   updated:live.updated,
   checked_at:new Date().toISOString(),
   fuel:live.fuel,
   lpg:live.lpg,
   note:!live.lpg_live
    ?"Fuel table is live. Gasul/LPG could not be verified from the current GasWatch render, so the last verified LPG values were kept."
    :"Live GasWatch fuel and LPG data loaded."
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
   ok:false,
   fallback:false,
   stale:true,
   partial:true,
   source:"GasWatch PH",
   source_url:SOURCE,
   updated:"",
   checked_at:new Date().toISOString(),
   fuel:[],
   lpg:[],
   note:"Live source unavailable and no previously verified copy exists. No static snapshot is shown.",
   error:String(e)
  },502,0);
 }
}
