const FRESH_TTL = 15;
const LAST_GOOD_TTL = 21600;

const GOOGLE_FEEDS = [
  "https://news.google.com/rss?hl=en-PH&gl=PH&ceid=PH:en",
  "https://news.google.com/rss/search?q=Philippines%20breaking%20when%3A1d&hl=en-PH&gl=PH&ceid=PH%3Aen",
  "https://news.google.com/rss/search?q=Philippines%20(PAGASA%20OR%20PHIVOLCS%20OR%20weather%20OR%20earthquake)%20when%3A1d&hl=en-PH&gl=PH&ceid=PH%3Aen"
];

const PAGE_SOURCES = [
  {name:"GMA NEWS", url:"https://r.jina.ai/https://www.gmanetwork.com/news/", kind:"gma"},
  {name:"PHILSTAR", url:"https://r.jina.ai/https://www.philstar.com/headlines", kind:"philstar"}
];

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
  return /celebrity|actor|actress|movie|series|fashion|beauty|recipe|concert|k-pop|showbiz|horoscope|lotto/i.test(title);
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
  return /^https?:\/\//i.test(s)?s:"";
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
  if(/home|headlines|news$|showbiz|lifestyle|privacy|contact|advertise|subscribe|see more|image|facebook|instagram|youtube|rss feed/i.test(title))return false;
  if(/\/news\/(?:$|index|rss)/i.test(url))return false;
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
  return parseJinaPage(section,"PHILSTAR","philstar.com");
}

function dedupe(items){
  const seen=new Set(),out=[],perSource=new Map();
  items.sort((a,b)=>b.ts-a.ts);
  for(const x of items){
    const key=x.headline.toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
    const short=key.split(" ").slice(0,11).join(" ");
    if(!key||seen.has(key)||seen.has(short))continue;
    const n=perSource.get(x.source)||0;
    if(n>=25)continue;
    seen.add(key);seen.add(short);perSource.set(x.source,n+1);
    out.push(x);
    if(out.length>=70)break;
  }
  return out;
}

async function collect(){
  const jobs=[];
  for(const u of GOOGLE_FEEDS)jobs.push({kind:"rss",name:"Google News",url:u,p:fetchText(u)});
  for(const s of PAGE_SOURCES)jobs.push({...s,p:fetchText(s.url)});
  const settled=await Promise.allSettled(jobs.map(j=>j.p));
  let items=[];
  const diagnostics=[];
  settled.forEach((r,i)=>{
    const job=jobs[i];
    if(r.status!=="fulfilled"){
      diagnostics.push({name:job.name||job.kind,ok:false,error:String(r.reason||"fetch failed")});
      return;
    }
    let parsed=[];
    try{
      if(job.kind==="rss")parsed=parseGoogleRss(r.value);
      else if(job.kind==="gma")parsed=parseGmaJina(r.value);
      else if(job.kind==="philstar")parsed=parsePhilstarJina(r.value);
    }catch(e){
      diagnostics.push({name:job.name||job.kind,ok:false,error:"parse: "+String(e)});
      return;
    }
    diagnostics.push({name:job.name||job.kind,ok:true,items:parsed.length});
    items.push(...parsed);
  });
  return {items:dedupe(items),diagnostics};
}

export async function onRequestGet(context){
  const cache=caches.default;
  const origin=new URL(context.request.url).origin;
  const freshKey=new Request(origin+"/api/news-cache-v4");
  const lastGoodKey=new Request(origin+"/api/news-last-good-v3");

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
      method:"direct Philippine sources + RSS fallback",
      checked_at:new Date().toISOString(),
      feed_count:GOOGLE_FEEDS.length+PAGE_SOURCES.length,
      feeds_ok:result.diagnostics.filter(x=>x.ok).length,
      source_count:sources.length,
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