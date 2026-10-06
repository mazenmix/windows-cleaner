const TTL=15;
const LAST_GOOD_TTL=21600;

const FEEDS=[
  {name:"PH Top",url:"https://news.google.com/rss?hl=en-PH&gl=PH&ceid=PH:en"},
  {name:"PH Breaking",url:"https://news.google.com/rss/search?q=Philippines%20breaking%20when%3A1d&hl=en-PH&gl=PH&ceid=PH%3Aen"},
  {name:"Metro Manila",url:"https://news.google.com/rss/search?q=%22Metro%20Manila%22%20when%3A1d&hl=en-PH&gl=PH&ceid=PH%3Aen"},
  {name:"Weather & Disasters",url:"https://news.google.com/rss/search?q=Philippines%20(PAGASA%20OR%20PHIVOLCS%20OR%20typhoon%20OR%20earthquake%20OR%20flood)%20when%3A1d&hl=en-PH&gl=PH&ceid=PH%3Aen"},
  {name:"Nation & Government",url:"https://news.google.com/rss/search?q=Philippines%20(government%20OR%20senate%20OR%20president%20OR%20DOTr%20OR%20MMDA)%20when%3A1d&hl=en-PH&gl=PH&ceid=PH%3Aen"},
  {name:"Business & Transport",url:"https://news.google.com/rss/search?q=Philippines%20(business%20OR%20economy%20OR%20fuel%20OR%20transport%20OR%20traffic)%20when%3A1d&hl=en-PH&gl=PH&ceid=PH%3Aen"}
];

const TRUSTED=[
  "GMA News Online","GMA News","INQUIRER.net","Philippine Daily Inquirer","Philstar.com","The Philippine Star",
  "ABS-CBN","ABS-CBN News","Philippine News Agency","PNA","Manila Bulletin","Rappler","Reuters",
  "BusinessWorld Online","BusinessWorld","The Manila Times","News5","One News","BusinessMirror","SunStar",
  "Cebu Daily News","MindaNews","DZRH","PTV","CNN","Associated Press","AP News","Agence France-Presse","AFP"
];

function decode(s){
  return String(s||"")
    .replace(/<!\[CDATA\[|\]\]>/g,"")
    .replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'")
    .replace(/&lt;/g,"<").replace(/&gt;/g,">")
    .replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCharCode(parseInt(h,16)))
    .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)))
    .trim();
}
function plain(s){return decode(s).replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim()}
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
  if(/^ptv|people.?s television/i.test(x))return"PTV";
  if(/associated press|ap news/i.test(x))return"AP";
  if(/agence france|\bafp\b/i.test(x))return"AFP";
  return x.toUpperCase();
}
function trusted(s){
  const x=plain(s).toLowerCase();
  return TRUSTED.some(v=>x.includes(v.toLowerCase()));
}
function stripSource(title,source){
  let t=plain(title);
  const s=plain(source);
  if(s){
    const safe=s.replace(/[.*+?^$()|[\]\\]/g,"\\$&");
    t=t.replace(new RegExp("\\s+-\\s+"+safe+"$","i"),"");
  }
  return t.trim();
}
function tag(block,name){
  const m=block.match(new RegExp("<"+name+"(?:\\s[^>]*)?>([\\s\\S]*?)<\\/"+name+">","i"));
  return m?m[1]:"";
}
function imageFrom(block,description){
  const tests=[
    /<media:content[^>]+url=["']([^"']+)["']/i,
    /<media:thumbnail[^>]+url=["']([^"']+)["']/i,
    /<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image\//i,
    /<img[^>]+src=["']([^"']+)["']/i
  ];
  for(const r of tests){
    const m=block.match(r)||String(description||"").match(r);
    if(m&&/^https?:\/\//i.test(decode(m[1])))return decode(m[1]);
  }
  return "";
}
function categoryFor(title){
  const t=title.toLowerCase();
  if(/earthquake|quake|phivolcs|tremor|aftershock/.test(t))return"Earthquake";
  if(/pagasa|typhoon|bagyo|storm|rain|flood|weather|heat index|monsoon|itcz|landslide/.test(t))return"Weather";
  if(/pnp|police|arrest|robber|robbery|shooting|murder|killed|crime|drug bust|kidnap/.test(t))return"Crime";
  if(/lrt|mrt|mmda|traffic|transport|airport|flight|airline|road|bus|jeep|train|nlex|slex/.test(t))return"Transport";
  if(/peso|inflation|economy|business|stock|market|bank|fuel price|oil price|interest rate|bsp|trade/.test(t))return"Business";
  if(/senate|senator|house|congress|president|marcos|duterte|malacañang|election|impeach|government|palace/.test(t))return"Politics";
  if(/tourism|travel|tourist|resort|beach|destination/.test(t))return"Travel";
  if(/basketball|pba|gilas|volleyball|football|boxing|sports|athlete|fiba|uaap|ncaa/.test(t))return"Sports";
  if(/technology|cyber|digital|ai\b|internet|telecom|smartphone|software|data breach/.test(t))return"Technology";
  if(/doh|health|hospital|disease|vaccine|virus|medical|medicine/.test(t))return"Health";
  return"Nation";
}
function isBreaking(title,ts){
  const age=Date.now()-ts;
  if(age>=0&&age<=10*60*1000)return true;
  return age>=0&&age<=45*60*1000&&/earthquake|quake|typhoon|storm surge|flood|fire|explosion|shooting|emergency|evacuat|landslide|crash|suspend|alert|hostage/i.test(title);
}
function parse(xml){
  const out=[];
  const blocks=String(xml||"").match(/<item>[\s\S]*?<\/item>/gi)||[];
  for(const item of blocks){
    const titleRaw=tag(item,"title");
    const linkRaw=tag(item,"link");
    const pubRaw=tag(item,"pubDate")||tag(item,"dc:date");
    const descRaw=tag(item,"description");
    const sm=item.match(/<source(?:\s+url=["'][^"']*["'])?>([\s\S]*?)<\/source>/i);
    const source=sm?plain(sm[1]):"";
    if(!titleRaw||!linkRaw||!source)continue;
    const headline=stripSource(titleRaw,source);
    if(headline.length<18)continue;
    if(/celebrity|actor|actress|movie|series|fashion|beauty|recipe|concert|k-pop|showbiz/i.test(headline))continue;
    const ts=Date.parse(plain(pubRaw))||0;
    if(!ts||Date.now()-ts>36*60*60*1000)continue;
    const description=plain(descRaw).replace(/\s+-\s+[^-]{2,80}$/,"").slice(0,260);
    out.push({
      headline,
      source:sourceLabel(source),
      source_full:source,
      url:plain(linkRaw),
      published_at:new Date(ts).toISOString(),
      ts,
      category:categoryFor(headline),
      breaking:isBreaking(headline,ts),
      image:imageFrom(item,descRaw),
      summary:description&&description.toLowerCase()!==headline.toLowerCase()?description:"",\n      trusted_source:trusted(source)
    });
  }
  return out;
}
async function get(url){
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),7000);
  try{
    const r=await fetch(url,{headers:{
      "user-agent":"Mozilla/5.0 (compatible; MXRapidFeed/2.0; +https://mxfuel.pages.dev/)",
      "accept":"application/rss+xml,application/xml,text/xml,*/*"
    },signal:ctrl.signal,cf:{cacheTtl:0,cacheEverything:false}});
    if(!r.ok)throw new Error("HTTP "+r.status);
    return await r.text();
  }finally{clearTimeout(timer)}
}
function dedupe(items){
  const seen=new Set(),perSource=new Map(),out=[];
  items.sort((a,b)=>b.ts-a.ts);
  for(const x of items){
    const key=x.headline.toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
    const short=key.split(" ").slice(0,10).join(" ");
    if(seen.has(key)||seen.has(short))continue;
    const n=perSource.get(x.source)||0;
    if(n>=10)continue;
    seen.add(key);seen.add(short);perSource.set(x.source,n+1);out.push(x);
    if(out.length>=60)break;
  }
  return out;
}
function response(data,status=200,ttl=TTL){
  return new Response(JSON.stringify(data),{status,headers:{
    "content-type":"application/json; charset=utf-8",
    "cache-control":"public, max-age=5, s-maxage="+ttl+", stale-while-revalidate=15",
    "access-control-allow-origin":"*"
  }});
}
export async function onRequestGet(context){
  const cache=caches.default;
  const origin=new URL(context.request.url).origin;
  const freshKey=new Request(origin+"/api/news-cache-v3");
  const lkgKey=new Request(origin+"/api/news-last-good-v2");
  const hit=await cache.match(freshKey);
  if(hit)return hit;
  try{
    const results=await Promise.allSettled(FEEDS.map(f=>get(f.url)));
    let items=[],feedOk=0;
    results.forEach((r,i)=>{
      if(r.status==="fulfilled"){feedOk++;items.push(...parse(r.value))}
    });
    items=dedupe(items);
    if(items.length<3)throw new Error("Not enough fresh headlines");
    const sources=[...new Set(items.map(x=>x.source))];
    const data={
      ok:true,live:true,stale:false,
      source:"MX Rapid Feed",
      method:"multi-feed aggregation",
      checked_at:new Date().toISOString(),
      feed_count:FEEDS.length,
      feeds_ok:feedOk,
      source_count:sources.length,
      sources,
      items
    };
    const out=response(data);
    const keep=response(data,200,LAST_GOOD_TTL);
    context.waitUntil(Promise.all([cache.put(freshKey,out.clone()),cache.put(lkgKey,keep.clone())]));
    return out;
  }catch(e){
    const last=await cache.match(lkgKey);
    if(last){
      try{
        const j=await last.clone().json();
        if(j&&Array.isArray(j.items)&&j.items.length){
          return response({...j,ok:true,live:false,stale:true,last_verified:true,checked_at:new Date().toISOString(),note:"Sources temporarily unavailable — showing the last verified feed.",error:String(e)},200,15);
        }
      }catch{}
    }
    return response({ok:false,live:false,stale:true,error:String(e),checked_at:new Date().toISOString(),items:[]},502,10);
  }
}