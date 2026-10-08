// MX NEWS — Celebrity / showbiz desk, public published stories only.
// RSS is refreshed periodically; this is not a wire-service priority feed.
const CACHE_SECONDS=45, LAST_GOOD_SECONDS=3600;
const MAX_AGE_MS=48*3600*1000;
const FEEDS=[
  {name:"PHILSTAR ENTERTAINMENT",kind:"rss",url:"https://www.philstar.com/rss/entertainment",source:"Philstar",local:true},
  {name:"RAPPLER ENTERTAINMENT",kind:"rss",url:"https://www.rappler.com/entertainment/feed/",source:"Rappler",local:true},
  {name:"ABS-CBN ENTERTAINMENT",kind:"rss",url:"https://www.abs-cbn.com/feed2",source:"ABS-CBN",local:false},
  {name:"GMA NEWS SHOWBIZ",kind:"rss",url:"https://data.gmanews.tv/gno/rss/news/feed.xml",source:"GMA News",local:false},
  {name:"INQUIRER HEADLINES",kind:"rss",url:"https://www.inquirer.net/fullfeed",source:"Inquirer",local:false},
  {name:"MANILA BULLETIN ENTERTAINMENT",kind:"rss",url:"https://mb.com.ph/rss/articles/entertainment",source:"Manila Bulletin",local:true},
  {name:"MANILA TIMES ENTERTAINMENT",kind:"rss",url:"https://www.manilatimes.net/entertainment/feed/",source:"Manila Times",local:true},
  {name:"PEP PH LATEST",kind:"rss",url:"https://www.pep.ph/rss",source:"PEP.ph",local:true},
  {name:"VARIETY HOLLYWOOD",kind:"rss",url:"https://variety.com/feed/",source:"Variety",local:true},
  {name:"DEADLINE HOLLYWOOD",kind:"rss",url:"https://deadline.com/feed/",source:"Deadline",local:true},
  {name:"BILLBOARD MUSIC",kind:"rss",url:"https://www.billboard.com/feed/",source:"Billboard",local:true},
  {name:"SHOWBIZ PH",kind:"google",query:"Philippines showbiz celebrities actor actress singer entertainment when:2d"},
  {name:"LOCAL STARS",kind:"google",query:"Filipino celebrity TV star actress actor romance music when:2d"},
  {name:"PEP PH",kind:"google",query:"site:pep.ph celebrity showbiz when:2d"},
  {name:"GMA ENTERTAINMENT",kind:"google",query:"site:gmanetwork.com/news/showbiz OR site:gmanetwork.com/entertainment when:2d"},
  {name:"ABS-CBN SHOWBIZ",kind:"google",query:"site:abs-cbn.com entertainment celebrity showbiz when:2d"},
  {name:"PHILSTAR CELEBRITY",kind:"google",query:"site:philstar.com/entertainment when:2d"},
  {name:"HOLLYWOOD",kind:"google",query:"Hollywood celebrity film star music entertainment when:2d"}
];
const ALLOWED_DOMAINS=[
  "philstar.com","pep.ph","gmanetwork.com","abs-cbn.com","rappler.com","inquirer.net",
  "mb.com.ph","manilabulletin.com.ph","manilatimes.net","manilastandard.net",
  "interaksyon.com","news.tv5.com.ph","tv5.com.ph","onenews.ph","cosmo.ph",
  "preview.ph","wheninmanila.com","billboard.com","billboardphilippines.com",
  "people.com","variety.com","hollywoodreporter.com","deadline.com",
  "eonline.com","etonline.com","usmagazine.com","vogue.com",
  "reuters.com","apnews.com"
];
function safeHost(url){try{return new URL(url).hostname.toLowerCase().replace(/^www\./,"")}catch(_){return""}}
function allowed(url){const host=safeHost(url);return ALLOWED_DOMAINS.some(d=>host===d||host.endsWith("."+d))}
function plain(str){return String(str||"").replace(/<!\[CDATA\[|\]\]>/g,"")
  .replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&apos;|&#39;/gi,"'")
  .replace(/&lt;/gi,"<").replace(/&gt;/gi,">")
  .replace(/&#x([a-f0-9]+);/gi,(_,s)=>String.fromCodePoint(parseInt(s,16)))
  .replace(/&#([0-9]+);/g,(_,s)=>String.fromCodePoint(Number(s)))
  .replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim()}
function tag(str,name){
 const m=String(str||"").match(new RegExp("<"+name+"(?:\\s[^>]*)?>([\\s\\S]*?)<\\/"+name+">","i"));
 return m?m[1]:"";
}
function sourceName(str){return plain(str).replace(/\s+/g," ").slice(0,50)}
function rssImage(block,description){
 const html=String(block||"")+" "+String(description||"");
 for(const re of [
  /<media:content\b[^>]*\burl=["']([^"']+)["']/i,
  /<media:thumbnail\b[^>]*\burl=["']([^"']+)["']/i,
  /<enclosure\b[^>]*\burl=["']([^"']+)["']/i,
  /<img\b[^>]*\bsrc=["']([^"']+)["']/i
 ]){
  const m=html.match(re);
  if(m&&/^https?:\/\//i.test(plain(m[1])))return plain(m[1]).slice(0,1600);
 }
 return "";
}
function titleIsCelebrity(headline){
 const t=headline.toLowerCase();
 if(/filipino|showbiz|celebrity|celebrit|entertainment|hollywood|kapamilya|kapuso|actor|actress|star|film|movie|singer|concert|performer|artist|music|album|k-pop|korean|miss universe|pageant|red carpet|fashion|dating|romance|wedding|engage|breakup|ex-boyfriend|ex-girlfriend|tv series|netflix|grammy|emmy|oscar|billboard/.test(t))return true;
 return false;
}
function createItem({title,url,date,description,image,source,local=false,curated=false}){
 const headline=plain(title).replace(/\s+-\s+(?:Philstar\.com|PEP\.ph|GMA News Online|ABS-CBN News|Rappler)$/i,"").trim();
 const ts=Date.parse(plain(date));
 const age=Date.now()-ts;
 if(!headline||headline.length<16||!/^https?:\/\//i.test(url)||!Number.isFinite(ts)||age< -300000||age>MAX_AGE_MS)return null;
 if(!local&&!curated&&!titleIsCelebrity(headline))return null;
 if(/(?:crypto|trading bot|betting odds|lottery|stock quote|live weather)\b/i.test(headline))return null;
 return {
  headline,source:sourceName(source)||"Entertainment",url,
  published_at:new Date(ts).toISOString(),ts,category:"Celebrity",
  breaking:false,image:image&&/^https?:\/\//i.test(image)?image:"",
  summary:plain(description).slice(0,230),trusted_source:true
 };
}
function parseFeed(xml,feed){
 const out=[],blocks=String(xml||"").match(/<item\b[^>]*>[\s\S]*?<\/item>|<entry\b[^>]*>[\s\S]*?<\/entry>/gi)||[];
 for(const block of blocks){
  let link=plain(tag(block,"link"));
  if(!link){const m=block.match(/<link\b[^>]*href=["']([^"']+)["']/i);if(m)link=plain(m[1])}
  if(!link)link=plain(tag(block,"guid"));
  const src=block.match(/<source(?:\s+url=["']([^"']*)["'])?[^>]*>([\s\S]*?)<\/source>/i);
  const source=feed.kind==="google"?sourceName(src&&src[2]):feed.source;
  const srcLink=src&&src[1]||"";
  // Google News RSS article links resolve to the publisher; check publisher metadata.
  if(feed.kind==="google"&&(!source||(!allowed(srcLink)&&!/^(PEP\.ph|GMA|ABS-CBN|Philstar|Rappler|Inquirer|Billboard|Manila Bulletin|People|Variety|Deadline|The Hollywood Reporter|E! News|Entertainment Tonight|Vogue|Reuters|Associated Press)$/i.test(source))))continue;
  if(feed.kind!=="google"&&!allowed(link))continue;
  const description=tag(block,"description")||tag(block,"summary")||tag(block,"content:encoded");
  const item=createItem({
   title:tag(block,"title"),url:link,
   date:tag(block,"pubDate")||tag(block,"published")||tag(block,"updated")||tag(block,"dc:date"),
   description,image:rssImage(block,description),
   source,local:feed.local===true||/\/entertainment\/feed|\/rss\/entertainment/i.test(feed.url),
   curated:feed.kind==="google"
  });
  if(item)out.push(item);
 }
 return out;
}
async function fetchFeed(feed){
 const url=feed.kind==="google"
  ?"https://news.google.com/rss/search?q="+encodeURIComponent(feed.query)+"&hl=en-PH&gl=PH&ceid=PH:en"
  :feed.url;
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),4100);
 try{
  const response=await fetch(url,{headers:{"user-agent":"Mozilla/5.0 (compatible; MXNewsCelebrityDesk/1.0)","accept":"application/rss+xml,application/atom+xml,text/xml,*/*"},signal:ctrl.signal,cf:{cacheTtl:0,cacheEverything:false}});
  if(!response.ok)throw new Error("HTTP "+response.status);
  return parseFeed(await response.text(),feed);
 }finally{clearTimeout(timer)}
}
function uniq(items){
 const found=new Set(),seenUrl=new Set(),output=[],perSource=new Map();
 for(const item of items.sort((a,b)=>b.ts-a.ts)){
  const normalized=item.headline.toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  const key=normalized.split(" ").slice(0,12).join(" ");
  if(!key||found.has(key)||seenUrl.has(item.url))continue;
  const count=perSource.get(item.source)||0;
  if(count>=25)continue;
  seenUrl.add(item.url);found.add(key);perSource.set(item.source,count+1);
  output.push(item);
  if(output.length>=100)break;
 }
 return output;
}
// "PH" identifies entertainment coverage from Philippine publishers,
 // unless the headline explicitly concerns a foreign-only celebrity story.
const PH_PUBLISHER=/^(Philstar|Rappler|ABS-CBN|GMA News|Inquirer|Manila Bulletin|Manila Times|PEP\.ph)$/i;
const WORLD_ONLY=/\b(?:hollywood|kardashian|jennifer lawrence|taylor swift|justin bieber|selena gomez|travis scott|ariana grande|billie eilish|leonardo dicaprio|brad pitt|tom cruise|lollapalooza argentina|paramount|skydance|wall street|new york stock exchange|noah centineo|andrew koji|solo leveling|the social reckoning|sorkin|hollywood film review)\b/i;
const PH_SIGNAL=/philippin|filipin|pinoy|pinay|manila|kapamilya|kapuso|gma|abs-cbn|vivamax|star magic|teleserye|quezon city|cebu|baguio|tv5|pinoy big brother/i;
function isPhilippineStory(item){
 const t=String(item.headline||"")+" "+String(item.summary||"");
 if(PH_SIGNAL.test(t))return true;
 return PH_PUBLISHER.test(String(item.source||""))&&!WORLD_ONLY.test(t);
}
function localRatio(items){
 const arr=Array.isArray(items)?items:[];
 const count=arr.filter(x=>x.market==="PH").length;
 return arr.length?Math.round(count/arr.length*100):0;
}
function importance(item){
 const ageH=Math.max(0,(Date.now()-item.ts)/3600000),t=item.headline.toLowerCase();
 let score=Math.max(0,90-ageH*2.2);
 if(/wedding|engag|split|breakup|pregnan|birth|death|died|pass(?:es|ed)? away|award|win|exclusive|confirms|announc|viral|premiere|comeback|concert|controversy|dating|relationship/.test(t))score+=18;
 if(/^(PEP|GMA|ABS-CBN|Philstar|Rappler|Variety|People|Billboard)/i.test(item.source))score+=6;
 return score;
}
function json(data,status=200,ttl=CACHE_SECONDS){
 return new Response(JSON.stringify(data),{status,headers:{
  "content-type":"application/json; charset=utf-8",
  "cache-control":"public, max-age=5, s-maxage="+ttl,
  "access-control-allow-origin":"*"
 }});
}
export async function onRequestGet(context){
 const cache=caches.default,origin=new URL(context.request.url).origin;
 const fresh=new Request(origin+"/api/celebrities-cache-v7-direct-images");
 const last=new Request(origin+"/api/celebrities-last-good-v7-direct-images");
 const hit=await cache.match(fresh);if(hit)return hit;
 try{
  const results=await Promise.allSettled(FEEDS.map(fetchFeed));
  const diagnostics=FEEDS.map((x,i)=>({name:x.name,ok:results[i].status==="fulfilled",items:results[i].status==="fulfilled"?results[i].value.length:0}));
  const valid=results.flatMap(r=>r.status==="fulfilled"?r.value:[]);
  const all=uniq(valid).map(x=>({...x,market:isPhilippineStory(x)?"PH":"WORLD"}));
  const ph=all.filter(x=>x.market==="PH");
  const world=all.filter(x=>x.market==="WORLD");
  // Enforce ≥80% PH across all displayed stories. When enough PH stories
  // are unavailable, show fewer items rather than mislabel foreign news.
  const worldQuota=Math.floor(ph.length/4);
  const items=uniq(ph.concat(world.slice(0,worldQuota))).sort((a,b)=>b.ts-a.ts);
  if(!items.length)throw new Error("No verified Philippine celebrity headlines are available");
  // 10 unique spotlight slides: 8 PH + at most 2 international stories.
  // The pool is editorially ranked, while the body remains newest-first.
  // Main ten-story carousel prioritizes direct publisher links.
  // Google News redirect links do not reliably provide OG photos.
  const directArticle=x=>{try{return new URL(x.url).hostname.toLowerCase()!=="news.google.com"}catch(_){return false}};
  const phPool=items.filter(x=>x.market==="PH");
  const worldPool=items.filter(x=>x.market==="WORLD");
  const preferred=(pool)=>pool.filter(directArticle).sort((a,b)=>importance(b)-importance(a)||b.ts-a.ts)
    .concat(pool.filter(x=>!directArticle(x)).sort((a,b)=>importance(b)-importance(a)||b.ts-a.ts));
  const rankedPH=preferred(phPool);
  const rankedWorld=preferred(worldPool);
  const featuredPH=rankedPH.slice(0,10);
  const featuredWorld=rankedWorld.slice(0,Math.min(2,Math.floor(featuredPH.length/4)));
  const featured=[];
  for(let i=0;i<featuredPH.length&&featured.length<10;i++){
   featured.push(featuredPH[i]);
   if((i===3||i===7)&&featuredWorld.length)featured.push(featuredWorld.shift());
  }
  const data={ok:true,live:true,stale:false,source:"Multi-source published entertainment RSS",
   checked_at:new Date().toISOString(),items,featured:featured.slice(0,10),
   philippines_percent:localRatio(items),spotlight_philippines_percent:localRatio(featured.slice(0,10)),
   source_count:new Set(items.map(x=>x.source)).size,feeds_ok:diagnostics.filter(x=>x.ok).length,feed_count:FEEDS.length,diagnostics};
  const answer=json(data),backup=json(data,200,LAST_GOOD_SECONDS);
  context.waitUntil(Promise.all([cache.put(fresh,answer.clone()),cache.put(last,backup.clone())]));
  return answer;
 }catch(e){
  const previous=await cache.match(last);
  if(previous){
   try{const data=await previous.json();const items=(data.items||[]).filter(x=>Date.now()-Number(x.ts||0)<MAX_AGE_MS);
    if(items.length)return json({...data,items,featured:(data.featured||[]).filter(x=>items.some(y=>y.url===x.url)),live:false,stale:true,note:"Showing last verified published stories while feeds reconnect."},200,15);
   }catch(_){}
  }
  return json({ok:false,live:false,stale:true,items:[],error:String(e),checked_at:new Date().toISOString()},503,10);
 }
}