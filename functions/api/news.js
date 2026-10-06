const FRESH_TTL = 15;
const LAST_GOOD_TTL = 21600;
const FRESH_WINDOW_MS = 3 * 60 * 60 * 1000;

const GOOGLE_FEEDS = [
  "https://news.google.com/rss?hl=en-PH&gl=PH&ceid=PH:en",
  "https://news.google.com/rss/search?q=Philippines%20breaking%20when%3A3h&hl=en-PH&gl=PH&ceid=PH%3Aen"
];

function googleCategoryFeed(q){
  return "https://news.google.com/rss/search?q="+encodeURIComponent(q+" when:3h")+"&hl=en-PH&gl=PH&ceid=PH:en";
}
const CATEGORY_GOOGLE_FEEDS = [
  {name:"SPORTS DESK",category:"Sports",url:googleCategoryFeed("Philippines (Gilas OR PBA OR UAAP OR NCAA OR boxing OR volleyball OR football OR sports)")},
  {name:"BUSINESS DESK",category:"Business",url:googleCategoryFeed("Philippines (business OR economy OR BSP OR peso OR inflation OR stock market OR jobs OR fuel prices)")},
  {name:"HEALTH DESK",category:"Health",url:googleCategoryFeed("Philippines (DOH OR health OR hospital OR disease OR outbreak OR medical OR medicine OR vaccine)")},
  {name:"WEATHER DESK",category:"Weather",url:googleCategoryFeed("Philippines (PAGASA OR typhoon OR weather OR flood OR storm OR monsoon OR heat index)")},
  {name:"POLITICS DESK",category:"Politics",url:googleCategoryFeed("Philippines (Senate OR Congress OR Marcos OR Duterte OR Malacanang OR election OR impeachment OR government)")},
  {name:"TECH DESK",category:"Technology",url:googleCategoryFeed("Philippines (technology OR cyber OR AI OR telecom OR digital OR internet OR data breach)")},
  {name:"TRAVEL DESK",category:"Travel",url:googleCategoryFeed("Philippines (tourism OR travel OR airport OR airline OR destination OR resort)")},
  {name:"TRANSPORT DESK",category:"Transport",url:googleCategoryFeed("Philippines (DOTr OR MMDA OR MRT OR LRT OR traffic OR transport OR airport OR flight OR road)")},
  {name:"CRIME DESK",category:"Crime",url:googleCategoryFeed("Philippines (PNP OR police OR arrest OR crime OR robbery OR shooting OR kidnapping)")},
  {name:"NATION DESK",category:"Nation",url:googleCategoryFeed("Philippines (Supreme Court OR government OR education OR agriculture OR national OR local government)")}
];

const RSS_SOURCES = [
  {name:"INQUIRER",url:"https://newsinfo.inquirer.net/feed/"},
  {name:"RAPPLER",url:"https://www.rappler.com/feed/"},
  {name:"BUSINESSWORLD",url:"https://www.bworldonline.com/feed/"},
  {name:"MINDANEWS",url:"https://mindanews.com/feed/"},
  {name:"BUSINESSMIRROR",url:"https://businessmirror.com.ph/feed/"},
  {name:"PNA",url:"https://www.pna.gov.ph/rss"},
  {name:"MANILA BULLETIN",url:"https://mb.com.ph/rss"},
  {name:"MANILA TIMES",url:"https://www.manilatimes.net/rss"}
];

function gdeltUrl(query){
  return "https://api.gdeltproject.org/api/v2/doc/doc?query="+encodeURIComponent(query)+"&mode=ArtList&maxrecords=150&format=json&sort=datedesc&timespan=3h";
}
const GDELT_FEEDS = [
  {name:"GDELT PH",url:gdeltUrl("Philippines")},
  {name:"GDELT NATIONAL",url:gdeltUrl("Philippines (domain:gmanetwork.com OR domain:philstar.com OR domain:inquirer.net OR domain:abs-cbn.com OR domain:pna.gov.ph OR domain:manilabulletin.com.ph OR domain:rappler.com)")},
  {name:"GDELT BUSINESS REGIONAL",url:gdeltUrl("Philippines (domain:bworldonline.com OR domain:businessmirror.com.ph OR domain:sunstar.com.ph OR domain:mindanews.com OR domain:manilatimes.net OR domain:news.tv5.com.ph OR domain:onenews.ph)")},
  {name:"GDELT WIRE",url:gdeltUrl("Philippines (domain:reuters.com OR domain:apnews.com)")}
];

const PAGE_SOURCES = [
  {name:"GMA DIRECT", url:"https://www.gmanetwork.com/news/", kind:"gmahtml"},
  {name:"PHILSTAR DIRECT", url:"https://www.philstar.com/headlines", kind:"philstarhtml"},
  {name:"GMA NEWS", url:"https://r.jina.ai/https://www.gmanetwork.com/news/", kind:"gma"},
  {name:"PHILSTAR", url:"https://r.jina.ai/https://www.philstar.com/headlines", kind:"philstar"}
];

const TRUSTED_DOMAINS = [
  "gmanetwork.com","philstar.com","inquirer.net","abs-cbn.com","pna.gov.ph","manilabulletin.com.ph","mb.com.ph",
  "rappler.com","bworldonline.com","news.tv5.com.ph","tv5.com.ph","onenews.ph","businessmirror.com.ph",
  "sunstar.com.ph","mindanews.com","manilatimes.net","reuters.com","apnews.com"
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
function sourceFromDomain(domain){
  const d=String(domain||"").toLowerCase().replace(/^www\./,"");
  if(/cebudailynews\.inquirer\.net$/.test(d))return"CEBU DAILY NEWS";
  if(/gmanetwork\.com$/.test(d))return"GMA NEWS";
  if(/philstar\.com$/.test(d))return"PHILSTAR";
  if(/inquirer\.net$/.test(d))return"INQUIRER";
  if(/abs-cbn\.com$/.test(d))return"ABS-CBN";
  if(/pna\.gov\.ph$/.test(d))return"PNA";
  if(/manilabulletin\.com\.ph$|mb\.com\.ph$/.test(d))return"MANILA BULLETIN";
  if(/rappler\.com$/.test(d))return"RAPPLER";
  if(/bworldonline\.com$/.test(d))return"BUSINESSWORLD";
  if(/news\.tv5\.com\.ph$|tv5\.com\.ph$/.test(d))return"NEWS5";
  if(/onenews\.ph$/.test(d))return"ONE NEWS";
  if(/businessmirror\.com\.ph$/.test(d))return"BUSINESSMIRROR";
  if(/sunstar\.com\.ph$/.test(d))return"SUNSTAR";
  if(/mindanews\.com$/.test(d))return"MINDANEWS";
  if(/manilatimes\.net$/.test(d))return"MANILA TIMES";
  if(/reuters\.com$/.test(d))return"REUTERS";
  if(/apnews\.com$/.test(d))return"AP";
  return"";
}
function trustedDomain(domain){
  const d=String(domain||"").toLowerCase().replace(/^www\./,"");
  return TRUSTED_DOMAINS.some(x=>d===x||d.endsWith("."+x));
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
  if(/pagasa|typhoon|bagyo|storm|rain|flood|weather|heat index|monsoon|itcz|landslide|el niño|la niña|storm surge/.test(t))return"Weather";
  if(/doh|department of health|health|hospital|disease|outbreak|vaccine|virus|medical|medicine|doctor|patient|dengue|measles|covid|mpox|mental health|hiv|tuberculosis/.test(t))return"Health";
  if(/basketball|pba|gilas|volleyball|football|boxing|sports|athlete|fiba|uaap|ncaa|olympic|sea games|asian games|tennis|golf|swimming|yulo|hidilyn/.test(t))return"Sports";
  if(/peso|inflation|economy|business|stock|market|bank|fuel price|oil price|interest rate|bsp|trade|investment|gdp|jobs|employment|company|earnings|tariff|export|import/.test(t))return"Business";
  if(/technology|cyber|digital|\bai\b|internet|telecom|smartphone|software|data breach|phishing|hack|ict|5g|satellite/.test(t))return"Technology";
  if(/tourism|travel|tourist|resort|beach|destination|hotel|vacation/.test(t))return"Travel";
  if(/lrt|mrt|mmda|traffic|transport|airport|flight|airline|road|bus|jeep|train|nlex|slex|dotr|ltfrb|lto/.test(t))return"Transport";
  if(/pnp|police|arrest|robber|robbery|shooting|murder|killed|crime|drug bust|kidnap|raid|suspect|nbi/.test(t))return"Crime";
  if(/senate|senator|house|congress|president|marcos|duterte|malacañang|malacanang|election|impeach|government|palace|amla|amlc|ombudsman|politic/.test(t))return"Politics";
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

function parseGoogleRss(xml,forcedCategory){
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
    if(obj){
      if(forcedCategory)obj.category=forcedCategory;
      out.push(obj);
    }
  }
  return out;
}

function rssImage(block,description){
  const src=String(block||"")+"\n"+String(description||"");
  const patterns=[
    /<media:content[^>]+url=["']([^"']+)["']/i,
    /<media:thumbnail[^>]+url=["']([^"']+)["']/i,
    /<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']image\//i,
    /<img[^>]+src=["']([^"']+)["']/i
  ];
  for(const re of patterns){
    const m=src.match(re);
    if(m&&/^https?:\/\//i.test(decode(m[1])))return decode(m[1]);
  }
  return"";
}
function parseGenericRss(xml,sourceHint){
  const out=[];
  const src=String(xml||"");
  const blocks=[
    ...(src.match(/<item>[\s\S]*?<\/item>/gi)||[]),
    ...(src.match(/<entry>[\s\S]*?<\/entry>/gi)||[])
  ];
  for(const block of blocks){
    const title=(block.match(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/i)||[])[1]||"";
    let link=(block.match(/<link>([\s\S]*?)<\/link>/i)||[])[1]||"";
    if(!link){
      const lm=block.match(/<link[^>]+href=["']([^"']+)["']/i);
      if(lm)link=lm[1];
    }
    if(!link){
      const gm=block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i);
      if(gm)link=gm[1];
    }
    const pub=(block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)||[])[1]
      ||(block.match(/<published>([\s\S]*?)<\/published>/i)||[])[1]
      ||(block.match(/<updated>([\s\S]*?)<\/updated>/i)||[])[1]
      ||(block.match(/<dc:date>([\s\S]*?)<\/dc:date>/i)||[])[1]||"";
    const desc=(block.match(/<description>([\s\S]*?)<\/description>/i)||[])[1]
      ||(block.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/i)||[])[1]
      ||(block.match(/<summary>([\s\S]*?)<\/summary>/i)||[])[1]||"";
    const h=cleanTitle(title);
    const url=normalizeUrl(plain(link));
    const ts=Date.parse(plain(pub))||0;
    if(!h||!url||!ts)continue;
    const obj=makeItem(h,sourceHint,url,ts,desc,rssImage(block,desc));
    if(obj&&philippinesRelevant(obj.headline))out.push(obj);
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
    let domain=String(a&&a.domain||"").toLowerCase();
    if(!domain&&url){try{domain=new URL(url).hostname}catch(_){}}
    const country=String(a&&a.sourcecountry||"").toLowerCase();
    if(!title||!url||excluded(title)||!trustedDomain(domain))continue;
    if(!philippinesRelevant(title)&&country!=="philippines")continue;
    let raw=String(a&&a.seendate||"");
    let ts=Date.parse(raw);
    if(!Number.isFinite(ts)){
      const m=raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
      if(m)ts=Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6]);
    }
    if(!Number.isFinite(ts)||!ts)continue;
    const source=sourceFromDomain(domain);
    if(!source)continue;
    const obj=makeItem(title,source,url,ts,"",normalizeUrl(a&&a.socialimage));
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
function isToday(item){
  const ts=Number(item&&item.ts||Date.parse(item&&item.published_at||0)||0);
  const age=Date.now()-ts;
  return ts>0&&age>=0&&age<=24*60*60*1000;
}
function importanceScore(item){
  const title=String(item&&item.headline||"").toLowerCase();
  const ageH=Math.max(0,(Date.now()-Number(item&&item.ts||0))/3600000);
  let score=Math.max(0,48-ageH*2);
  if(item&&item.breaking)score+=34;
  const source=String(item&&item.source||"");
  if(/REUTERS|AP/.test(source))score+=22;
  else if(/GMA NEWS|INQUIRER|ABS-CBN|PNA|PHILSTAR|RAPPLER|MANILA BULLETIN/.test(source))score+=16;
  else if(/BUSINESSWORLD|NEWS5|ONE NEWS|BUSINESSMIRROR|SUNSTAR|MINDANEWS|MANILA TIMES/.test(source))score+=11;
  if(/president|senate|congress|supreme court|impeach|earthquake|typhoon|storm surge|evacuat|emergency|explosion|shooting|killed|inflation|interest rate|bsp|west philippine sea|china|alert|suspend/.test(title))score+=24;
  if(/doh|outbreak|hospital|dengue|mpox|health emergency/.test(title))score+=18;
  if(/gilas|pba|uaap|fiba|boxing|olympic|gold medal|champion/.test(title))score+=12;
  if(/live:|breaking|just in/.test(title))score+=14;
  return score;
}
function selectTopToday(items,limit=10){
  const ranked=(items||[]).filter(isToday).slice().sort((a,b)=>importanceScore(b)-importanceScore(a)||b.ts-a.ts);
  const out=[],perSource=new Map(),perCategory=new Map();
  for(const x of ranked){
    const sn=perSource.get(x.source)||0,cn=perCategory.get(x.category)||0;
    if(sn>=3||cn>=4)continue;
    out.push(x);perSource.set(x.source,sn+1);perCategory.set(x.category,cn+1);
    if(out.length>=limit)break;
  }
  if(out.length<limit){
    for(const x of ranked){
      if(out.some(y=>y.url===x.url))continue;
      out.push(x);if(out.length>=limit)break;
    }
  }
  return out;
}

function dedupe(items){
  const seen=new Set(),seenUrls=new Set(),out=[],perSource=new Map();
  items.sort((a,b)=>b.ts-a.ts);
  for(const x of items){
    const key=x.headline.toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
    const short=key.split(" ").slice(0,11).join(" ");
    if(!key||seen.has(key)||seen.has(short)||(x.url&&seenUrls.has(x.url)))continue;
    const n=perSource.get(x.source)||0;
    if(n>=8)continue;
    seen.add(key);seen.add(short);if(x.url)seenUrls.add(x.url);perSource.set(x.source,n+1);
    out.push(x);
    if(out.length>=80)break;
  }
  return out;
}

async function collect(){
  const diagnostics=[];
  let items=[];

  const primary=PAGE_SOURCES.filter(s=>s.kind==="gmahtml"||s.kind==="philstarhtml");
  const firstWave=[
    ...primary.map(s=>({...s,timeout:3200})),
    ...RSS_SOURCES.map(s=>({kind:"rssdirect",name:s.name,url:s.url,timeout:2200})),
    ...CATEGORY_GOOGLE_FEEDS.map(s=>({kind:"catrss",name:s.name,url:s.url,category:s.category,timeout:1900})),
    ...GDELT_FEEDS.map(s=>({kind:"gdelt",name:s.name,url:s.url,timeout:2800}))
  ];

  const settled=await Promise.allSettled(firstWave.map(j=>fetchText(j.url,j.timeout)));
  settled.forEach((r,i)=>{
    const job=firstWave[i];
    if(r.status!=="fulfilled"){
      diagnostics.push({name:job.name,ok:false,error:String(r.reason||"fetch failed")});
      return;
    }
    let parsed=[];
    try{
      if(job.kind==="gmahtml")parsed=parseDirectHtml(r.value,"GMA NEWS","gmanetwork.com").filter(x=>philippinesRelevant(x.headline));
      else if(job.kind==="philstarhtml")parsed=parsePhilstarDirectHtml(r.value);
      else if(job.kind==="rssdirect")parsed=parseGenericRss(r.value,job.name);
      else if(job.kind==="catrss")parsed=parseGoogleRss(r.value,job.category);
      else if(job.kind==="gdelt")parsed=parseGdeltJson(r.value);
      diagnostics.push({name:job.name,ok:true,items:parsed.length});
      items.push(...parsed);
    }catch(e){
      diagnostics.push({name:job.name,ok:false,error:"parse: "+String(e)});
    }
  });

  let combined=dedupe(items);
  let fresh=combined.filter(isFresh3h);
  let sourceCount=new Set(fresh.map(x=>x.source)).size;

  // Emergency fallback only if breadth or volume is still thin.
  if(fresh.length<14||sourceCount<4){
    const fallbacks=[
      ...GOOGLE_FEEDS.map((url,i)=>({kind:"rss",name:"GOOGLE PH "+(i+1),url,timeout:1800})),
      ...PAGE_SOURCES.filter(s=>s.kind==="gma"||s.kind==="philstar").map(s=>({...s,timeout:1800}))
    ];
    const second=await Promise.allSettled(fallbacks.map(j=>fetchText(j.url,j.timeout)));
    second.forEach((r,i)=>{
      const job=fallbacks[i];
      if(r.status!=="fulfilled"){
        diagnostics.push({name:job.name,ok:false,error:String(r.reason||"fetch failed")});
        return;
      }
      let parsed=[];
      try{
        if(job.kind==="rss")parsed=parseGoogleRss(r.value);
        else if(job.kind==="gma")parsed=parseGmaJina(r.value).filter(x=>philippinesRelevant(x.headline));
        else if(job.kind==="philstar")parsed=parsePhilstarJina(r.value);
        diagnostics.push({name:job.name,ok:true,items:parsed.length});
        items.push(...parsed);
      }catch(e){
        diagnostics.push({name:job.name,ok:false,error:"parse: "+String(e)});
      }
    });
    combined=dedupe(items);
    fresh=combined.filter(isFresh3h);
    sourceCount=new Set(fresh.map(x=>x.source)).size;
  }

  return {
    items:combined,
    diagnostics,
    feedCount:firstWave.length,
    fastPath:false,
    fresh3h:fresh.length,
    sourceCount
  };
}

export async function onRequestGet(context){
  const cache=caches.default;
  const origin=new URL(context.request.url).origin;
  const freshKey=new Request(origin+"/api/news-cache-v14");
  const lastGoodKey=new Request(origin+"/api/news-last-good-v13");

  const cached=await cache.match(freshKey);
  if(cached)return cached;

  try{
    const result=await collect();
    const items=result.items.filter(isFresh3h).sort((a,b)=>b.ts-a.ts);
    if(items.length<3)throw Object.assign(new Error("Not enough headlines inside the strict 3-hour window"),{diagnostics:result.diagnostics});

    const topToday=selectTopToday(result.items,10);
    const categoryCounts={};
    for(const x of items)categoryCounts[x.category]=(categoryCounts[x.category]||0)+1;
    const sources=[...new Set(items.map(x=>x.source))];
    const data={
      ok:true,
      live:true,
      stale:false,
      source:"MX Rapid Feed",
      method:"Curated multi-source Philippine newsroom",
      checked_at:new Date().toISOString(),
      feed_count:result.feedCount||2,
      feeds_ok:result.diagnostics.filter(x=>x.ok).length,
      source_count:sources.length,
      fresh_3h_count:items.length,
      freshness_window_minutes:180,
      top_today:topToday,
      category_counts:categoryCounts,
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
          const stillFresh=j.items.filter(isFresh3h).sort((a,b)=>b.ts-a.ts);
          if(!stillFresh.length)throw new Error("Last verified headlines have expired beyond 3 hours");
          const stillTop=Array.isArray(j.top_today)?j.top_today.filter(isToday):[];
          return response({
            ...j,
            items:stillFresh,
            top_today:stillTop,
            fresh_3h_count:stillFresh.length,
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