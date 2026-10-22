const TTL=35;
const LAST_GOOD_TTL=5400; // maximum 90-minute explicitly delayed fallback
const news=(query)=>"https://news.google.com/rss/search?q="+encodeURIComponent(query)+"&hl=en-PH&gl=PH&ceid=PH%3Aen";
// Multiple independent publishers, not only one PAGASA search result.
// Direct publisher feeds serve as additional origins if Google News has problems.
const FEEDS=[
 {url:news('Philippines (PAGASA OR typhoon OR storm OR rainfall OR flood) when:2d'),source:null},
 {url:news('Philippines (weather OR low pressure area OR monsoon OR habagat) when:2d'),source:null},
 {url:news('site:gmanetwork.com/news (PAGASA OR typhoon OR weather OR rainfall OR flood) when:2d'),source:null},
 {url:news('site:philstar.com (PAGASA OR typhoon OR weather OR flood) when:2d'),source:null},
 {url:news('site:inquirer.net (PAGASA OR typhoon OR weather OR flooding) when:2d'),source:null},
 {url:news('site:abs-cbn.com (PAGASA OR typhoon OR weather OR rainfall) when:2d'),source:null},
 {url:news('site:rappler.com (PAGASA OR typhoon OR storm OR flood) when:2d'),source:null},
 {url:news('site:pna.gov.ph (PAGASA OR typhoon OR weather OR flood) when:2d'),source:null},
 {url:news('site:mb.com.ph (PAGASA OR typhoon OR rainfall OR weather) when:2d'),source:null},
 {url:news('site:sunstar.com.ph (PAGASA OR typhoon OR rainfall OR flood) when:2d'),source:null},
 {url:"https://data.gmanews.tv/gma/rss/weather.xml",source:"GMA News Online"},
 {url:"https://www.philstar.com/rss/headlines",source:"The Philippine Star"},
 {url:"https://www.pna.gov.ph/rss",source:"Philippine News Agency"}
];
const TRUSTED=[
 "GMA News Online","GMA News","INQUIRER.net","Philippine Daily Inquirer","Philstar.com","The Philippine Star",
 "ABS-CBN","ABS-CBN News","Philippine News Agency","PNA","Manila Bulletin","Rappler","Reuters",
 "BusinessWorld Online","BusinessWorld","The Manila Times","News5","One News","BusinessMirror"
];
function decode(s){
 return String(s||"").replace(/<!\[CDATA\[|\]\]>/g,"")
 .replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'")
 .replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
}
function label(s){
 const x=decode(s);
 if(/gma/i.test(x))return"GMA";
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
 return x.toUpperCase();
}
function trusted(s){const x=decode(s).toLowerCase();return TRUSTED.some(v=>x.includes(v.toLowerCase()))}
function stripSource(title,source){
 let t=decode(title),s=decode(source);
 if(s){const safe=s.replace(/[.*+?^$()|[\]\\]/g,"\\$&");t=t.replace(new RegExp("\\s+-\\s+"+safe+"$","i"),"")}
 return t.trim();
}
function weatherRelevant(s){
 return /(pagasa|typhoon|tropical cyclone|tropical depression|tropical storm|storm signal|lpa|low pressure area|rain|rainfall|flood|weather|monsoon|habagat|amihan|thunderstorm|gale warning|landslide|river basin|cyclone|wind signal)/i.test(s);
}
function parse(xml,defaultSource=''){
 const out=[],items=String(xml||"").match(/<item>[\s\S]*?<\/item>/gi)||[];
 for(const item of items){
  const title=(item.match(/<title>([\s\S]*?)<\/title>/i)||[])[1]||"";
  const link=(item.match(/<link>([\s\S]*?)<\/link>/i)||[])[1]||"";
  const pub=(item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)||[])[1]||"";
  const sm=item.match(/<source(?:\s+url="[^"]*")?>([\s\S]*?)<\/source>/i);
  const source=sm?decode(sm[1]):defaultSource;
  if(!title||!link||!source||!trusted(source))continue;
  const headline=stripSource(title,source);
  if(headline.length<18||!weatherRelevant(headline)||/\b(?:RSS feed retired|feed has been retired|feed is discontinued)\b/i.test(headline))continue;
  const ts=Date.parse(pub);
  if(!Number.isFinite(ts)||ts<=0)continue; // never present an undated RSS item as breaking news
  out.push({headline,source:label(source),url:decode(link),published_at:new Date(ts).toISOString(),ts});
 }
 return out;
}
async function get(feed){
 const c=new AbortController(),t=setTimeout(()=>c.abort(),4500);
 try{
  const r=await fetch(feed.url,{headers:{"user-agent":"Mozilla/5.0 (compatible; MXWeatherNews/1.0)","accept":"application/rss+xml,application/xml,text/xml,*/*"},signal:c.signal});
  if(!r.ok)throw new Error("HTTP "+r.status);
  const body=await r.text();
  if(!/<(?:rss|feed|rdf:RDF)\b/i.test(body)||!/<(?:item|entry)\b/i.test(body))throw new Error('Not an RSS/Atom feed: '+feed.url);
  return {body,source:feed.source};
 }finally{clearTimeout(t)}
}
function dedupe(items){
 const seen=new Set(),perSource=new Map(),out=[];
 items.sort((a,b)=>b.ts-a.ts);
 for(const x of items){
  const k=x.headline.toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  if(seen.has(k))continue;
  const n=perSource.get(x.source)||0;if(n>=6)continue;
  seen.add(k);perSource.set(x.source,n+1);out.push(x);if(out.length>=30)break;
 }
 return out;
}
function response(data,status=200){
 return new Response(JSON.stringify(data),{status,headers:{
  "content-type":"application/json; charset=utf-8",
  "cache-control":status===200?"public, max-age=0, s-maxage="+TTL:"no-store",
  "access-control-allow-origin":"*"
 }});
}
export async function onRequestGet(context){
 const cache=caches.default,u=new URL(context.request.url);
 const freshKey=new Request(u.origin+"/api/weather-news-cache-v3");
 const lkgKey=new Request(u.origin+"/api/weather-news-last-good-v2");
 const hit=await cache.match(freshKey);if(hit)return hit;
 try{
  const rs=await Promise.allSettled(FEEDS.map(get));let items=[];
  const feedCount=rs.filter(r=>r.status==="fulfilled").length;
  for(const r of rs)if(r.status==="fulfilled")items.push(...parse(r.value.body,r.value.source||''));
  const now=Date.now();
  // Google News RSS is not a live wire. Reject headlines older than 36 hours
  // or with implausible future publication timestamps; newest published first.
  items=dedupe(items).filter(x=>x.ts>now-36*3600000&&x.ts<=now+20*60000);
  if(items.length<1)throw new Error("No recently published and dated weather headlines");
  const data={ok:true,live:true,stale:false,checked_at:new Date().toISOString(),
    sources_checked:FEEDS.length,feeds_responded:feedCount,latest_published_at:items[0].published_at,items};
  const out=response(data);
  const keep=new Response(JSON.stringify(data),{status:200,headers:{
   "content-type":"application/json; charset=utf-8",
   "cache-control":"public, max-age="+LAST_GOOD_TTL+", s-maxage="+LAST_GOOD_TTL,
   "access-control-allow-origin":"*"
  }});
  context.waitUntil(Promise.all([cache.put(freshKey,out.clone()),cache.put(lkgKey,keep.clone())]));
  return out;
 }catch(e){
  const last=await cache.match(lkgKey);
  if(last){
   try{
    const j=await last.clone().json();
    const originalChecked=Date.parse(j?.checked_at||"");
    const acceptable=Number.isFinite(originalChecked)&&Date.now()-originalChecked<=LAST_GOOD_TTL*1000;
    const freshItems=(j?.items||[]).filter(x=>Number.isFinite(Date.parse(x.published_at))&&Date.now()-Date.parse(x.published_at)<=36*3600000);
    if(acceptable&&freshItems.length){
     return response({...j,items:freshItems,ok:true,live:false,stale:true,last_verified:true,
       checked_at:new Date().toISOString(),last_verified_at:j.checked_at,
       note:"RSS feed temporarily unavailable. Showing explicitly delayed recent headlines only.",error:String(e)},200);
    }
   }catch{}
  }
  return response({ok:false,live:false,stale:true,error:String(e),checked_at:new Date().toISOString(),items:[]},502);
 }
}
