const FRESH_TTL = 15;
const LAST_GOOD_TTL = 21600;
const FRESH_WINDOW_MS = 3 * 60 * 60 * 1000;

const GOOGLE_FEEDS = [
  "https://news.google.com/rss?hl=en-PH&gl=PH&ceid=PH:en",
  "https://news.google.com/rss/search?q=Philippines%20breaking%20when%3A1d&hl=en-PH&gl=PH&ceid=PH%3Aen",
  "https://news.google.com/rss/search?q=Philippines%20(PAGASA%20OR%20PHIVOLCS%20OR%20weather%20OR%20earthquake)%20when%3A1d&hl=en-PH&gl=PH&ceid=PH%3Aen"
];

const PAGE_SOURCES = [
  {name:"GMA DIRECT", url:"https://www.gmanetwork.com/news/", kind:"gmahtml"},
  {name:"PHILSTAR DIRECT", url:"https://www.philstar.com/headlines", kind:"philstarhtml"},
  {name:"GMA NEWS", url:"https://r.jina.ai/https://www.gmanetwork.com/news/", kind:"gma"},
  {name:"PHILSTAR", url:"https://r.jina.ai/https://www.philstar.com/headlines", kind:"philstar"}
];

const GDELT_URL = "https://api.gdeltproject.org/api/v2/doc/doc?query=Philippines&mode=ArtList&maxrecords=75&format=json&sort=datedesc&timespan=1d";

const TRUSTED = [
  "GMA News Online","GMA News","INQUIRER.net","Philippine Daily Inquirer","Philstar.com","The Philippine Star",
  "ABS-CBN","ABS-CBN News","Philippine News Agency","PNA","Manila Bulletin","Rappler","Reuters",
  "BusinessWorld Online","BusinessWorld","The Manila Times","News5","One News","BusinessMirror","SunStar",
  "Cebu Daily News","MindaNews","DZRH","PTV","Associated Press","AP News","Agence France-Presse","AFP"
];

function response(data,status=200,ttl=FRESH_TTL){
  return new Response(JSON.stringify(data),{
    status,
    headers:{
      "content-type":"application/json; charset=utf-8",
      "cache-control":"public, max-age=3, s-maxage="+ttl+", stale-while-revalidate=15",
      "access-control-allow-origin":"*"
    }
  });
}

async function fetchText(url,timeout=10000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const isJina=/^https:\/\/r\.jina\.ai\//i.test(url);
    const headers={
      "user-agent":"Mozilla/5.0 (compatible; MXRapidFeed/3.0; +https://mxfuel.pages.dev/)",
      "accept":isJina?"text/plain,text/markdown,*/*":"application/rss+xml,application/xml,text/xml,text/html,*/*",
      "cache-control":"no-cache, no-store",
      "pragma":"no-cache"
    };
    if(isJina){
      headers["x-no-cache"]="true";
      headers["x-cache-tolerance"]="0";
      headers["x-timeout"]="10";
    }
    const r=await fetch(url,{
      headers,
      signal:controller.signal,
      cf:{cacheTtl:0,cacheEverything:false}
    });
    if(!r.ok)throw new Error("HTTP "+r.status);
    return await r.text();
  }finally{
    clearTimeout(timer);
  }
}

function decode(s){
  return String(s||"")
    .replace(/<!\[CDATA\[|\]\]>/g,"")
    .replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'")
    .replace(/&lt;/g,"<").replace(/&gt;/g,">")
    .replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCharCode(parseInt(h,16)))
    .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)))
    .trim();
}
function plain(s){
  return decode(s).replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
}
function cleanTitle(s){
  return plain(s)
    .replace(/^LIVE\s*[:\-]?\s*/i,"LIVE: ")
    .replace(/^LIVE:\s*(?:just now|moments? ago|\d+\s*(?:s|sec|secs|seconds?|m|min|mins|minutes?|h|hr|hrs|hours?)\s*ago)\s*/i,"LIVE: ")
    .replace(/\s+(?:just now|moments? ago|\d+\s*(?:s|sec|secs|seconds?|m|min|mins|minutes?|h|hr|hrs|hours?)\s*ago)\s*$/i,"")
    .replace(/\s+/g," ")
    .trim();
}
function sourceLabel(s){
  const x=plain(s);
  if(/gma/i.test(x))return"GMA NEWS";
  if(/inquirer/i.test(x))return"INQUIRER";
  if(/philstar|philippine star/i.test(x))return"PHILSTAR";
  if(/abs-cbn/i.test(x))return"ABS-CBN";
  if(/philippine news agency|^pna$/i.test(x))return"PNA";
  if(/manila bulletin/i.test(x))return"MANILA BULLETIN";
  if(/rappler/i.test(x))return"RAPPLER";
  if(/reuters/i.test(x))return"REUTERS";
  if(/businessworld/i.test(x))return"BUSINESSWORLD";
  if(/manila times/i.test(x))return"MANILA TIMES";
  if(/news5/i.test(x))return"NEWS5";
  if(/one news/i.test(x))return"ONE NEWS";
  if(/businessmirror/i.test(x))return"BUSINESSMIRROR";
  if(/sunstar/i.test(x))return"SUNSTAR";
  if(/cebu daily/i.test(x))return"CEBU DAILY NEWS";
  if(/mindanews/i.test(x))return"MINDANEWS";
  if(/dzrh/i.test(x))return"DZRH";
  if(/associated press|ap news/i.test(x))return"AP";
  if(/agence france|\bafp\b/i.test(x))return"AFP";
  return x.toUpperCase();
}
function trusted(s){
  const x=plain(s).toLowerCase();
  return TRUSTED.some(v=>x.includes(v.toLowerCase()));
}
function stripSource(title,source){
  let t=cleanTitle(title);
  const s=plain(source);
  if(s){
    const safe=s.replace(/[.*+?^$()|[\]\\]/g,"\\$&");
    t=t.replace(new RegExp("\\s+-\\s+"+safe+"$","i"),"");
  }
  return t.trim();
}
function categoryFor(title){
  const t=String(title||"").toLowerCase();
  if(/earthquake|quake|phivolcs|tremor|aftershock/.test(t))return"Earthquake";
  if(/pagasa|typhoon|bagyo|storm|rain|flood|weather|heat index|monsoon|itcz|landslide|el niño|la niña/.test(t))return"Weather";
  if(/pnp|police|arrest|robber|robbery|shooting|murder|killed|crime|drug bust|kidnap/.test(t))return"Crime";
  if(/lrt|mrt|mmda|traffic|transport|airport|flight|airline|road|bus|jeep|train|nlex|slex/.test(t))return"Transport";
  if(/peso|inflation|economy|business|stock|market|bank|fuel price|oil price|interest rate|bsp|trade/.test(t))return"Business";
  if(/senate|senator|house|congress|president|marcos|duterte|malacañang|election|impeach|government|palace|amla|amlc/.test(t))return"Politics";
  if(/tourism|travel|tourist|resort|beach|destination/.test(t))return"Travel";
  if(/basketball|pba|gilas|volleyball|football|boxing|sports|athlete|fiba|uaap|ncaa|nba/.test(t))return"Sports";
  if(/technology|cyber|digital|\bai\b|internet|telecom|smartphone|software|data breach/.test(t))return"Technology";
  if(/doh|health|hospital|disease|vaccine|virus|medical|medicine/.test(t))return"Health";
  return"Nation";
}
function excluded(title){
  return /celebrity|actor|actress|movie|series|fashion|beauty|recipe|concert|k-pop|showbiz|horoscope|lotto|\bnba\b|nfl|mlb|premier league/i.test(title);
}
function philippinesRelevant(title){
  const t=String(title||"").toLowerCase();
  return /philippin|filipino|pinoy|metro manila|manila|luzon|visayas|mindanao|cebu|davao|batangas|cavite|laguna|bulacan|rizal|pampanga|tarlac|bicol|palawan|iloilo|bacolod|negros|leyte|samar|bohol|baguio|la union|zamboanga|cagayan|quezon city|makati|taguig|pasay|pasig|caloocan|marcos|duterte|malacañang|senate|senator|congress|house of representatives|amla|amlc|bsp|peso|pagasa|phivolcs|ndrrmc|pnp|doh|dotr|mmda|deped|department of|gilas|pba|uaap|ncaa|ofw|west philippine sea|bajo de masinloc|spratly|ayungin|edsa|nlex|slex|lrt|mrt|jeepney|barangay|mayor|governor|palace|government|inflation|fuel price|rice price|el niño|la niña|asean|sb19/i.test(t);
}
function isBreaking(title,ts){
  const age=Date.now()-Number(ts||0);
  if(age>=0&&age<=10*60*1000)return true;
  return age>=0&&age<=45*60*1000&&/earthquake|quake|typhoon|storm surge|flood|fire|explosion|shooting|emergency|evacuat|landslide|crash|suspend|alert|hostage|inflation|amla|amlc/i.test(title);
}
function relativeToTs(raw){
  const s=String(raw||"").toLowerCase().trim();
  if(!s)return 0;
  if(/just now|moments? ago/.test(s))return Date.now();
  let m=s.match(/(\d+)\s*(?:s|sec|secs|second|seconds)\s*ago/);
  if(m)return Date.now()-Number(m[1])*1000;
  m=s.match(/(\d+)\s*(?:m|min|mins|minute|minutes)\s*ago/);
  if(m)return Date.now()-Number(m[1])*60000;
  m=s.match(/(\d+)\s*(?:h|hr|hrs|hour|hours)\s*ago/);
  if(m)return Date.now()-Number(m[1])*3600000;
  m=s.match(/(\d+)\s*(?:d|day|days)\s*ago/);
  if(m)return Date.now()-Number(m[1])*86400000;
  return 0;
}
function normalizeUrl(url){
  const s=decode(url);
  if(!/^https?:\/\//i.test(s))return "";
  try{
    const u=new URL(s);
    u.hash="";
    u.search="";
    return u.href.replace(/\/$/,"");
  }catch(e){return s}
}
function makeItem(headline,source,url,ts,summary="",image=""){
  const h=cleanTitle(headline);
  const when=Number(ts||0);
  if(!h||h.length<18||!when||Date.now()-when>48*3600000||excluded(h))return null;
  return {
    headline:h,
    source,
    source_full:source,
    url:normalizeUrl(url),
    published_at:new Date(when).toISOString(),
    ts:when,
    category:categoryFor(h),
    breaking:isBreaking(h,when),
    image:image||"",
    summary:plain(summary).slice(0,260),
    trusted_source:true
  };
}

function parseGoogleRss(xml){
  const out=[];
  const blocks=String(xml||"").match(/<item>[\s\S]*?<\/item>/gi)||[];
  for(const item of blocks){
    const title=(item.match(/<title>([\s\S]*?)<\/title>/i)||[])[1]||"";
    const link=(item.match(/<link>([\s\S]*?)<\/link>/i)||[])[1]||"";
    const pub=(item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)||[])[1]||"";
    const desc=(item.match(/<description>([\s\S]*?)<\/description>/i)||[])[1]||"";
    const sm=item.match(/<source(?:\s+url=["'][^"']*["'])?>([\s\S]*?)<\/source>/i);
    const source=sm?plain(sm[1]):"";
    if(!title||!link||!source||!trusted(source))continue;
    const h=stripSource(title,source);
    const obj=makeItem(h,sourceLabel(source),plain(link),Date.parse(plain(pub))||0,desc);
    if(obj)out.push(obj);
  }
  return out;
}

function markdownLinks(text){
  const out=[];
  const re=/\[([^\]\n]{8,300})\]\((https?:\/\/[^\s)]+)\)/g;
  let m;
  while((m=re.exec(String(text||"")))){
    out.push({title:cleanTitle(m[1]),url:m[2],index:m.index,end:re.lastIndex});
  }
  return out;
}
function nearbyAge(text,start,end){
  const src=String(text||"");
  const before=src.slice(Math.max(0,start-160),start);
  const after=src.slice(end,Math.min(src.length,end+120));
  const patterns=[
    /(?:just now|moments? ago|\d+\s*(?:s|sec|secs|seconds?|m|min|mins|minutes?|h|hr|hrs|hours?|d|days?)\s*ago)/ig
  ];
  let best="";
  for(const p of patterns){
    const a=[...before.matchAll(p)];if(a.length)best=a[a.length-1][0];
    if(!best){const b=after.match(p);if(b)best=b[0]}
  }
  return best;
}
function validNewsLink(title,url,domain){
  if(!title||title.length<18||title.length>260)return false;
  if(!url.includes(domain))return false;
  if(/home|headlines|news$|privacy|contact|advertise|subscribe|see more|image|facebook|instagram|youtube|rss feed/i.test(title))return false;
  if(/\/news\/(?:$|index|rss)/i.test(url))return false;
  let path="";
  try{path=new URL(url).pathname}catch(e){return false}
  if(domain==="gmanetwork.com"&&!/\/news\/[^/]+\/[^/]+\/\d+\/.+\/(?:story|video)\/?$/i.test(path))return false;
  if(domain==="philstar.com"&&!/^\/(?:headlines|nation|business|sports|entertainment|lifestyle|world|other-sections)\/20\d\d\/\d{1,2}\/\d{1,2}\/\d+\//i.test(path))return false;
  if(/\/authors?\//i.test(path))return false;
  return !excluded(title);
}
function parseJinaPage(text,source,domain){
  const out=[];
  for(const l of markdownLinks(text)){
    if(!validNewsLink(l.title,l.url,domain))continue;
    const age=nearbyAge(text,l.index,l.end);
    const ts=relativeToTs(age);
    if(!ts)continue;
    const obj=makeItem(l.title,source,l.url,ts,"");
    if(obj)out.push(obj);
  }
  return out;
}
function parsePhilstarDirectHtml(text){
  const src=String(text||"");
  const out=[];
  const re=/<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/gi;
  let m;
  while((m=re.exec(src))){
    const block=m[1];
    const a=block.match(/<a\b[^>]*href=["'](https?:\/\/[^"']*philstar\.com[^"']*)["'][^>]*>([\s\S]*?)<\/a>/i);
    if(!a)continue;
    const url=normalizeUrl(a[1]);
    const title=cleanTitle(a[2]);
    if(!validNewsLink(title,url,"philstar.com"))continue;
    const start=Math.max(0,m.index-1400),end=Math.min(src.length,re.lastIndex+700);
    const around=src.slice(start,end);
    const focus=m.index-start;
    const am=around.match(/(?:just now|moments? ago|\d+\s*(?:s|sec|secs|seconds?|m|min|mins|minutes?|h|hr|hrs|hours?)\s*ago)/i);
    const ts=relativeToTs(am&&am[0]);
    if(!ts)continue;
    const image=nearestImage(around,focus,url);
    const obj=makeItem(title,"PHILSTAR",url,ts,"",image);
    if(obj)out.push(obj);
  }
  return out;
}

function parseGmaJina(text){
  const src=String(text||"");
  const just=src.match(/(?:##\s*Just In|Just In)([\s\S]{0,7000}?)(?:##\s*Top News|SEE MORE ARTICLES|Top News)/i);
  const section=just?just[1]:src.slice(0,14000);
  return parseJinaPage(section,"GMA NEWS","gmanetwork.com");
}
function parsePhilstarJina(text){
  const src=String(text||"");
  const marker=src.search(/#{1,4}\s*Headlines/i);
  const section=marker>=0?src.slice(marker,marker+16000):src.slice(0,18000);
  const out=[];
  const re=/^#{1,4}\s*\[([^\]\n]{18,260})\]\((https?:\/\/[^\s)]+philstar\.com[^\s)]*)\)/gmi;
  let m;
  while((m=re.exec(section))){
    const title=cleanTitle(m[1]),url=normalizeUrl(m[2]);
    if(!validNewsLink(title,url,"philstar.com"))continue;
    const age=nearbyAge(section,m.index,re.lastIndex);
    const ts=relativeToTs(age);
    if(!ts)continue;
    const obj=makeItem(title,"PHILSTAR",url,ts,"");
    if(obj)out.push(obj);
  }
  return out;
}


function parseGdeltJson(text){
  const out=[];
  let j;
  try{j=JSON.parse(String(text||""))}catch(e){return out}
  const arr=Array.isArray(j&&j.articles)?j.articles:[];
  for(const a of arr){
    const title=cleanTitle(a&&a.title);
    const url=normalizeUrl(a&&a.url);
    const domain=String(a&&a.domain||"").toLowerCase();
    const country=String(a&&a.sourcecountry||"").toLowerCase();
    if(!title||!url||excluded(title))continue;
    if(!/philippines|manila|filipino|duterte|marcos|pagasa|phivolcs|senate|pnp|bsp|peso|cebu|davao/i.test(title) && country!=="philippines")continue;
    let raw=String(a&&a.seendate||"");
    let ts=Date.parse(raw);
    if(!Number.isFinite(ts)){
      const m=raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
      if(m)ts=Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6]);
    }
    if(!Number.isFinite(ts)||!ts)continue;
    let src=domain?domain.replace(/^www\./,"").toUpperCase():"GDELT";
    if(/gmanetwork/.test(domain))src="GMA NEWS";
    else if(/philstar/.test(domain))src="PHILSTAR";
    else if(/inquirer/.test(domain))src="INQUIRER";
    else if(/abs-cbn/.test(domain))src="ABS-CBN";
    else if(/pna\.gov\.ph/.test(domain))src="PNA";
    else if(/manilabulletin/.test(domain))src="MANILA BULLETIN";
    else if(/rappler/.test(domain))src="RAPPLER";
    const obj=makeItem(title,src,url,ts,"",normalizeUrl(a&&a.socialimage));
    if(obj)out.push(obj);
  }
  return out;
}
function resolveImage(raw,base){
  let u=decode(String(raw||"").trim());
  if(!u)return "";
  // srcset may contain multiple candidates; prefer the last/largest candidate.
  if(/\s+\d+(?:w|x)(?:\s*,|$)/i.test(u)){
    const parts=u.split(",").map(x=>x.trim().split(/\s+/)[0]).filter(Boolean);
    if(parts.length)u=parts[parts.length-1];
  }
  if(/^data:/i.test(u)||/logo|sprite|favicon|avatar|icon|placeholder|blank\.gif|tracking|pixel/i.test(u))return "";
  try{
    if(u.startsWith("//"))u="https:"+u;
    u=new URL(u,base).href;
    if(!/^https?:\/\//i.test(u))return "";
    return u;
  }catch(_){return ""}
}
function nearestImage(snippet,focus,base){
  const src=String(snippet||"");
  const candidates=[];
  const attrRe=/(?:data-original|data-lazy-src|data-src|srcset|src)=["']([^"']+)["']/gi;
  let m;
  while((m=attrRe.exec(src))){
    const u=resolveImage(m[1],base);
    if(!u)continue;
    candidates.push({u,dist:Math.abs((m.index||0)-Number(focus||0))});
  }
  const bgRe=/background-image\s*:\s*url\((?:["']?)([^)"']+)(?:["']?)\)/gi;
  while((m=bgRe.exec(src))){
    const u=resolveImage(m[1],base);
    if(!u)continue;
    candidates.push({u,dist:Math.abs((m.index||0)-Number(focus||0))});
  }
  candidates.sort((a,b)=>a.dist-b.dist);
  return candidates.length?candidates[0].u:"";
}

function parseDirectHtml(text,source,domain){
  const src=String(text||"");
  const out=[];
  const re=/<a\b[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while((m=re.exec(src))){
    const url=decode(m[1]);
    const title=plain(m[2]);
    if(!validNewsLink(title,url,domain))continue;
    const start=Math.max(0,m.index-1000),end=Math.min(src.length,re.lastIndex+1000);
    const around=src.slice(start,end);
    const focus=m.index-start;
    const am=around.match(/(?:just now|moments? ago|\d+\s*(?:s|sec|secs|seconds?|m|min|mins|minutes?|h|hr|hrs|hours?)\s*ago)/i);
    const ts=relativeToTs(am&&am[0]);
    if(!ts)continue;
    const image=nearestImage(around,focus,url);
    const obj=makeItem(title,source,url,ts,"",image);
    if(obj)out.push(obj);
  }
  return out;
}

function isFresh3h(item){
  const ts=Number(item&&item.ts||Date.parse(item&&item.published_at||0)||0);
  const age=Date.now()-ts;
  return ts>0&&age>=0&&age<=FRESH_WINDOW_MS;
}

function dedupe(items){
  const seen=new Set(),seenUrls=new Set(),out=[],perSource=new Map();
  items.sort((a,b)=>b.ts-a.ts);
  for(const x of items){
    const key=x.headline.toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
    const short=key.split(" ").slice(0,11).join(" ");
    if(!key||seen.has(key)||seen.has(short)||(x.url&&seenUrls.has(x.url)))continue;
    const n=perSource.get(x.source)||0;
    if(n>=25)continue;
    seen.add(key);seen.add(short);if(x.url)seenUrls.add(x.url);perSource.set(x.source,n+1);
    out.push(x);
    if(out.length>=70)break;
  }
  return out;
}

async function collect(){
  const diagnostics=[];
  let items=[];

  // Fast path: these two direct publisher pages are the sources that are
  // actually succeeding from Cloudflare. Do not make the user wait for
  // rate-limited Google/GDELT/Jina requests before returning headlines.
  const primary=PAGE_SOURCES.filter(s=>s.kind==="gmahtml"||s.kind==="philstarhtml");
  const primarySettled=await Promise.allSettled(primary.map(s=>fetchText(s.url,4500)));
  primarySettled.forEach((r,i)=>{
    const job=primary[i];
    if(r.status!=="fulfilled"){
      diagnostics.push({name:job.name,ok:false,error:String(r.reason||"fetch failed")});
      return;
    }
    let parsed=[];
    try{
      if(job.kind==="gmahtml")parsed=parseDirectHtml(r.value,"GMA NEWS","gmanetwork.com").filter(x=>philippinesRelevant(x.headline));
      else if(job.kind==="philstarhtml")parsed=parsePhilstarDirectHtml(r.value);
      diagnostics.push({name:job.name,ok:true,items:parsed.length});
      items.push(...parsed);
    }catch(e){
      diagnostics.push({name:job.name,ok:false,error:"parse: "+String(e)});
    }
  });

  items=dedupe(items);
  const freshPrimary=items.filter(isFresh3h);
  if(items.length>=3&&freshPrimary.length>=6){
    return {items,diagnostics,feedCount:primary.length,fastPath:true,fresh3h:freshPrimary.length};
  }

  // Fallback path is only used when both direct publisher pages are weak/down.
  const fallbacks=[
    {kind:"gdelt",name:"GDELT",url:GDELT_URL},
    ...GOOGLE_FEEDS.map(url=>({kind:"rss",name:"Google News",url})),
    ...PAGE_SOURCES.filter(s=>s.kind==="gma"||s.kind==="philstar")
  ];
  const settled=await Promise.allSettled(fallbacks.map(j=>fetchText(j.url,4000)));
  settled.forEach((r,i)=>{
    const job=fallbacks[i];
    if(r.status!=="fulfilled"){
      diagnostics.push({name:job.name,ok:false,error:String(r.reason||"fetch failed")});
      return;
    }
    let parsed=[];
    try{
      if(job.kind==="gdelt")parsed=parseGdeltJson(r.value);
      else if(job.kind==="rss")parsed=parseGoogleRss(r.value);
      else if(job.kind==="gma")parsed=parseGmaJina(r.value).filter(x=>philippinesRelevant(x.headline));
      else if(job.kind==="philstar")parsed=parsePhilstarJina(r.value);
      diagnostics.push({name:job.name,ok:true,items:parsed.length});
      items.push(...parsed);
    }catch(e){
      diagnostics.push({name:job.name,ok:false,error:"parse: "+String(e)});
    }
  });
  const combined=dedupe(items);
  return {items:combined,diagnostics,feedCount:primary.length+fallbacks.length,fastPath:false,fresh3h:combined.filter(isFresh3h).length};
}

export async function onRequestGet(context){
  const cache=caches.default;
  const origin=new URL(context.request.url).origin;
  const freshKey=new Request(origin+"/api/news-cache-v11");
  const lastGoodKey=new Request(origin+"/api/news-last-good-v10");

  const cached=await cache.match(freshKey);
  if(cached)return cached;

  try{
    const result=await collect();
    const items=result.items;
    if(items.length<3)throw Object.assign(new Error("Not enough fresh headlines"),{diagnostics:result.diagnostics});

    const sources=[...new Set(items.map(x=>x.source))];
    const data={
      ok:true,
      live:true,
      stale:false,
      source:"MX Rapid Feed",
      method:result.fastPath?"Direct Philippine sources":"Direct Philippine sources + emergency fallbacks",
      checked_at:new Date().toISOString(),
      feed_count:result.feedCount||2,
      feeds_ok:result.diagnostics.filter(x=>x.ok).length,
      source_count:sources.length,
      fresh_3h_count:Number(result.fresh3h!=null?result.fresh3h:items.filter(isFresh3h).length),
      freshness_window_minutes:180,
      sources,
      diagnostics:result.diagnostics,
      items
    };

    const out=response(data,200,FRESH_TTL);
    const keep=response(data,200,LAST_GOOD_TTL);
    context.waitUntil(Promise.all([
      cache.put(freshKey,out.clone()),
      cache.put(lastGoodKey,keep.clone())
    ]));
    return out;
  }catch(e){
    const last=await cache.match(lastGoodKey);
    if(last){
      try{
        const j=await last.clone().json();
        if(j&&Array.isArray(j.items)&&j.items.length){
          return response({
            ...j,
            ok:true,live:false,stale:true,last_verified:true,
            checked_at:new Date().toISOString(),
            note:"Live sources are retrying — showing the last verified headlines.",
            error:String(e),
            diagnostics:e&&e.diagnostics?e.diagnostics:j.diagnostics
          },200,15);
        }
      }catch(_){}
    }
    return response({
      ok:false,live:false,stale:true,
      error:String(e),
      diagnostics:e&&e.diagnostics?e.diagnostics:[],
      checked_at:new Date().toISOString(),
      items:[]
    },502,5);
  }
}