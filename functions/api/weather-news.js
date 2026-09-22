const TTL=300;
const FEEDS=[
 "https://news.google.com/rss/search?q=Philippines%20(PAGASA%20OR%20typhoon%20OR%20storm%20OR%20LPA)%20when%3A2d&hl=en-PH&gl=PH&ceid=PH%3Aen",
 "https://news.google.com/rss/search?q=Philippines%20(flood%20OR%20heavy%20rain%20OR%20rainfall%20OR%20weather%20warning)%20when%3A2d&hl=en-PH&gl=PH&ceid=PH%3Aen",
 "https://news.google.com/rss/search?q=PAGASA%20Philippines%20weather%20when%3A2d&hl=en-PH&gl=PH&ceid=PH%3Aen"
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
function parse(xml){
 const out=[],items=String(xml||"").match(/<item>[\s\S]*?<\/item>/gi)||[];
 for(const item of items){
  const title=(item.match(/<title>([\s\S]*?)<\/title>/i)||[])[1]||"";
  const link=(item.match(/<link>([\s\S]*?)<\/link>/i)||[])[1]||"";
  const pub=(item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)||[])[1]||"";
  const sm=item.match(/<source(?:\s+url="[^"]*")?>([\s\S]*?)<\/source>/i);
  const source=sm?decode(sm[1]):"";
  if(!title||!link||!source||!trusted(source))continue;
  const headline=stripSource(title,source);
  if(headline.length<18||!weatherRelevant(headline))continue;
  out.push({headline,source:label(source),url:decode(link),published_at:pub,ts:Date.parse(pub)||0});
 }
 return out;
}
async function get(url){
 const c=new AbortController(),t=setTimeout(()=>c.abort(),8500);
 try{
  const r=await fetch(url,{headers:{"user-agent":"Mozilla/5.0 (compatible; MXWeatherNews/1.0)","accept":"application/rss+xml,application/xml,text/xml,*/*"},signal:c.signal});
  if(!r.ok)throw new Error("HTTP "+r.status);
  return await r.text();
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
  "cache-control":"public, max-age="+TTL+", s-maxage="+TTL,
  "access-control-allow-origin":"*"
 }});
}
export async function onRequestGet(context){
 const cache=caches.default,u=new URL(context.request.url),key=new Request(u.origin+"/api/weather-news-cache-v1");
 const hit=await cache.match(key);if(hit)return hit;
 try{
  const rs=await Promise.allSettled(FEEDS.map(get));let items=[];
  for(const r of rs)if(r.status==="fulfilled")items.push(...parse(r.value));
  items=dedupe(items);
  if(items.length<5)throw new Error("Not enough weather headlines");
  const out=response({ok:true,checked_at:new Date().toISOString(),items});
  context.waitUntil(cache.put(key,out.clone()));return out;
 }catch(e){
  return response({ok:false,error:String(e),checked_at:new Date().toISOString(),items:[]},502);
 }
}
