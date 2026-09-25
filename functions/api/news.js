const TTL=60;
const LAST_GOOD_TTL=2592000;
const FEEDS=[
 "https://news.google.com/rss/search?q=Philippines%20when%3A1d&hl=en-PH&gl=PH&ceid=PH%3Aen",
 "https://news.google.com/rss/search?q=Philippines%20(weather%20OR%20economy%20OR%20transport%20OR%20oil%20OR%20power)%20when%3A1d&hl=en-PH&gl=PH&ceid=PH%3Aen",
 "https://news.google.com/rss/search?q=Philippines%20(national%20OR%20business%20OR%20technology%20OR%20sports)%20when%3A1d&hl=en-PH&gl=PH&ceid=PH%3Aen"
];

const TRUSTED=[
 "GMA News Online","GMA News","INQUIRER.net","Philippine Daily Inquirer","Philstar.com","The Philippine Star",
 "ABS-CBN","ABS-CBN News","Philippine News Agency","PNA","Manila Bulletin","Rappler","Reuters",
 "BusinessWorld Online","BusinessWorld","The Manila Times","News5","One News","BusinessMirror"
];

function decode(s){
 return String(s||"")
  .replace(/<!\[CDATA\[|\]\]>/g,"")
  .replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'")
  .replace(/&lt;/g,"<").replace(/&gt;/g,">")
  .replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
}
function hostLabel(s){
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
function trusted(s){
 const x=decode(s).toLowerCase();
 return TRUSTED.some(v=>x.includes(v.toLowerCase()));
}
function stripSource(title,source){
 let t=decode(title);
 const s=decode(source);
 if(s){
   const safe=s.replace(/[.*+?^$()|[\]\\]/g,"\\$&");
   t=t.replace(new RegExp("\\s+-\\s+"+safe+"$","i"),"");
 }
 return t.trim();
}
function parse(xml){
 const out=[];
 const items=String(xml||"").match(/<item>[\s\S]*?<\/item>/gi)||[];
 for(const item of items){
   const title=(item.match(/<title>([\s\S]*?)<\/title>/i)||[])[1]||"";
   const link=(item.match(/<link>([\s\S]*?)<\/link>/i)||[])[1]||"";
   const pub=(item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)||[])[1]||"";
   const sm=item.match(/<source(?:\s+url="[^"]*")?>([\s\S]*?)<\/source>/i);
   const source=sm?decode(sm[1]):"";
   if(!title||!link||!source||!trusted(source))continue;
   const headline=stripSource(title,source);
   if(headline.length<18)continue;
   // Keep the ticker useful: exclude obvious celebrity/lifestyle-only pieces.
   if(/celebrity|actor|actress|movie|series|fashion|beauty|recipe|cookies|concert|k-pop|showbiz/i.test(headline))continue;
   const ts=Date.parse(pub)||0;
   out.push({headline,source:hostLabel(source),source_full:source,url:decode(link),published_at:pub,ts});
 }
 return out;
}
async function get(url){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),8000);
 try{
  const r=await fetch(url,{headers:{"user-agent":"Mozilla/5.0 (compatible; MXNewsTicker/1.0)","accept":"application/rss+xml,application/xml,text/xml,*/*"},signal:ctrl.signal});
  if(!r.ok)throw new Error("HTTP "+r.status);
  return await r.text();
 }finally{clearTimeout(timer)}
}
function dedupe(items){
 const seen=new Set(),perSource=new Map(),out=[];
 items.sort((a,b)=>b.ts-a.ts);
 for(const x of items){
   const key=x.headline.toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
   if(seen.has(key))continue;
   const n=perSource.get(x.source)||0;
   if(n>=5)continue;
   seen.add(key);perSource.set(x.source,n+1);out.push(x);
   if(out.length>=32)break;
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
 const cache=caches.default;
 const origin=new URL(context.request.url).origin;
 const freshKey=new Request(origin+"/api/news-cache-v2");
 const lkgKey=new Request(origin+"/api/news-last-good-v1");
 const hit=await cache.match(freshKey);
 if(hit)return hit;
 try{
   const xmls=await Promise.allSettled(FEEDS.map(get));
   let items=[];
   for(const r of xmls)if(r.status==="fulfilled")items.push(...parse(r.value));
   items=dedupe(items);
   if(items.length<8)throw new Error("Not enough trusted headlines");
   const data={ok:true,live:true,stale:false,source:"Google News aggregation of trusted Philippine publishers",checked_at:new Date().toISOString(),items};
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
     if(j&&Array.isArray(j.items)&&j.items.length){
      return response({...j,ok:true,live:false,stale:true,last_verified:true,checked_at:new Date().toISOString(),note:"News source temporarily unavailable — last verified headlines kept.",error:String(e)},200);
     }
    }catch{}
   }
   return response({ok:false,live:false,stale:true,error:String(e),checked_at:new Date().toISOString(),items:[]},502);
 }
}
