// Independent, source-verified PAGASA watch. Never infer an all-clear from failed fetches.
const CYCLONE_URL='https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin';
const THREAT_URL='https://www.pagasa.dost.gov.ph/tropical-cyclone/tc-threat-potential-forecast';
const FLOOD_URL='https://www.pagasa.dost.gov.ph/flood';
const POLL_SECONDS=90;
const MONTHS={january:0,february:1,march:2,april:3,may:4,june:5,july:6,august:7,september:8,october:9,november:10,december:11};

function decode(s){
 return String(s||'').replace(/&(?:nbsp|#160);/gi,' ')
  .replace(/&amp;/gi,'&').replace(/&quot;/gi,'"')
  .replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
  .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)))
  .replace(/&#([0-9]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,10)));
}
function plain(html){
 return decode(String(html||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
  .replace(/<!--[\s\S]*?-->/g,' ')
  .replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
}
function short(s,max=160){const t=plain(s);return t.length>max?t.slice(0,max).replace(/\s+\S*$/,'')+'…':t;}
function issuedISO(t){
 const m=t.match(/Issued at\s+(\d{1,2}):(\d{2})\s*(am|pm),?\s*(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
 if(!m)return null;
 const h=(Number(m[1])%12)+(m[3].toLowerCase()==='pm'?12:0);
 const stamp=Date.UTC(Number(m[6]),MONTHS[m[5].toLowerCase()],Number(m[4]),h-8,Number(m[2]));
 return Number.isFinite(stamp)?new Date(stamp).toISOString():null;
}
function parseCyclone(html,now=Date.now()){
 const all=plain(html);
 const noActive=/No Active Tropical Cyclone within the Philippine Area of Responsibility/i.test(all);
 const marker=/Tropical Cyclone Bulletin\s*#\s*(\d{1,3})\b/i.exec(all);
 if(noActive && !marker)return {state:'clear',active:false,status:'No active tropical cyclone within PAR',source:CYCLONE_URL};
 if(!marker)return {state:'unavailable',active:null,status:'PAGASA bulletin could not be confirmed',source:CYCLONE_URL};
 const b=all.slice(marker.index,marker.index+12500);
 const heading=b.match(/(?:Super Typhoon|Typhoon|Severe Tropical Storm|Tropical Storm|Tropical Depression)\s*["“']?([A-Za-z][A-Za-z -]{1,44}?)["”']?\s*(?=Issued at|(?:Super Typhoon|Typhoon|Severe Tropical Storm|Tropical Storm|Tropical Depression)|\s+Issued at)/i)
  ||b.match(/(?:Super Typhoon|Typhoon|Severe Tropical Storm|Tropical Storm|Tropical Depression)\s*["“']([A-Za-z -]{2,40})["”']/i);
 const categoryMatch=b.match(/\b(Super Typhoon|Severe Tropical Storm|Tropical Depression|Tropical Storm|Typhoon)\s*["“']/i);
 const name=heading?.[1]?.trim().replace(/["”']+$/,'')||null;
 const issue=issuedISO(b);
 // Do not equate an archive, old story, or navigation label with an active storm.
 if(!name||!issue)return {state:'unavailable',active:null,status:'Latest cyclone details are unverified',source:CYCLONE_URL};
 const age=now-Date.parse(issue);
 if(age < -3600000)return {state:'unavailable',active:null,status:'Unverified future bulletin timestamp',source:CYCLONE_URL};
 const wind=b.match(/Maximum sustained winds of\s*(\d{1,3})\s*km\/h/i);
 const gust=b.match(/gustiness of up to\s*(\d{1,3})\s*km\/h/i);
 const movement=b.match(/\bMovement\s+(Moving\s+[A-Za-z -]{4,55}?\s+at\s+\d{1,3}\s*km\/h)/i);
 const center=b.match(/\bLocation of Eye\/center\s+(?:The center[\s\S]{0,200}?\bat\s+)(.{5,125}?)(?=\s+Movement\b)/i);
 const next=b.match(/next advisory to be issued at\s+(\d{1,2}:\d{2}\s*(?:AM|PM)[^)]{0,28})/i);
 const stale=age>18*3600000;
 return {
  state:stale?'stale':'active',active:true,
  status:'Active PAGASA tropical cyclone bulletin',
  name:name.toUpperCase(),category:categoryMatch?.[1]||'Tropical Cyclone',
  bulletin_no:Number(marker[1]),issued_at:issue,stale,
  center:center?short(center[1],120):null,
  movement:movement?short(movement[1],85):null,
  wind_kmh:wind?Number(wind[1]):null,gust_kmh:gust?Number(gust[1]):null,
  next_advisory:next?short(next[1],60):null,
  source:CYCLONE_URL
 };
}
function parseThreat(html){
 const t=plain(html),period=t.match(/\bDate\s*:\s*([A-Za-z]+\s+\d{1,2},\s*20\d{2}\s*-\s*[A-Za-z]+\s+\d{1,2},\s*20\d{2})/i);
 if(!/TC.Threat Potential Forecast/i.test(t))return {state:'unavailable',period:null,source:THREAT_URL};
 return {state:'available',period:period?.[1]||null,source:THREAT_URL,
   summary:'PAGASA 2-week cyclone formation outlook; model guidance, not a confirmed storm warning.'};
}
function parseFlood(html){
 const t=plain(html);
 if(!/flood/i.test(t)||t.length<25)return {state:'unavailable',active_count:null,source:FLOOD_URL};
 const statuses=[],seen=new Set();
 const re=/(Pampanga|Agno|Bicol|Cagayan|Pasig[ -]Marikina|Abra|Ilog-Hilabangan|Jalaur|Panay|Tagum-Libuganon|Apayao-Abulug|Agusan|Agus|Buayan-Malungon|Davao|Tagoloan|Angat)\s+(Non-Flood Watch|Flood Outlook|Flood Advisory|Flood Warning|Critical Flood Warning)/gi;
 let m;while((m=re.exec(t))!==null){const id=(m[1]+'|'+m[2]).toLowerCase();if(!seen.has(id)){seen.add(id);statuses.push({basin:m[1],status:m[2]})}}
 const active=statuses.filter(x=>!/Non-Flood Watch/i.test(x.status));
 // A general PAGASA landing page with no parsed bulletins is unknown, not "all clear".
 return {state:statuses.length?(active.length?'active':'clear'):'unverified',
    active_count:statuses.length?active.length:null,
    summary:active.length?short(active.map(x=>x.basin+': '+x.status).join(' • '),220):
      statuses.length?'No active warnings in parsed major-basin bulletins':'Check PAGASA Flood Information for basin-specific advisories.',
    source:FLOOD_URL};
}
async function official(url){
 const c=new AbortController(),id=setTimeout(()=>c.abort(),11000);
 try{
  const r=await fetch(url,{signal:c.signal,redirect:'follow',headers:{'Accept':'text/html,application/xhtml+xml','User-Agent':'MXFuel-PAGASA-Live/1.0'},cf:{cacheTtl:0}});
  if(!r.ok)throw new Error('PAGASA HTTP '+r.status);
  const h=await r.text();if(h.length<300)throw new Error('Empty PAGASA page');
  return h;
 }finally{clearTimeout(id)}
}
function response(data,status=200,age=POLL_SECONDS){
 return new Response(JSON.stringify(data),{status,headers:{
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':status===200?'public, max-age=0, s-maxage='+age:'no-store',
  'Access-Control-Allow-Origin':'*',
  'X-Content-Type-Options':'nosniff'
 }});
}
export async function onRequestGet(context){
 const now=new Date().toISOString(),origin=new URL(context.request.url).origin;
 const cache=typeof caches!=='undefined'?caches.default:null;
 const key=new Request(origin+'/api/pagasa-live:cache');
 if(cache){const cached=await cache.match(key);if(cached)return cached;}
 const fetched=await Promise.allSettled([official(CYCLONE_URL),official(THREAT_URL),official(FLOOD_URL)]);
 const cyclone=fetched[0].status==='fulfilled'?parseCyclone(fetched[0].value):{state:'unavailable',active:null,status:'PAGASA cyclone bulletin unavailable',source:CYCLONE_URL};
 const threat=fetched[1].status==='fulfilled'?parseThreat(fetched[1].value):{state:'unavailable',period:null,source:THREAT_URL};
 const flood=fetched[2].status==='fulfilled'?parseFlood(fetched[2].value):{state:'unavailable',active_count:null,source:FLOOD_URL};
 const good=fetched.some(x=>x.status==='fulfilled');
 const body={ok:good,checked_at:now,cyclone,threat,flood,refresh_seconds:60};
 const out=response(body,good?200:503,good?POLL_SECONDS:0);
 if(good&&cache)context.waitUntil(cache.put(key,out.clone()));
 return out;
}
// Export parsers for reproducible tests without calling live services.
export const __test={parseCyclone,parseThreat,parseFlood,issuedISO};
