/* MX NEWS — isolated Celebrity Spotlight view. Existing news desk remains untouched. */
(function(){
"use strict";
const stage=document.getElementById("mxCelebrityStage");
const bar=document.getElementById("categories");
const tab=bar&&bar.querySelector('[data-cat="Celebrity"]');
if(!stage||!bar||!tab)return;
const featureRoot=document.getElementById("mxCelebrityFeature");
const newsRoot=document.getElementById("mxCelebrityGrid");
const searchEl=document.getElementById("searchInput");
const state={items:[],featured:[],sourceCount:0,checkedAt:"",signature:"",loaded:false,loading:false,stale:false,error:"",slideItems:[],slideIndex:0,slideTimer:null};
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function safeUrl(url){try{const u=new URL(String(url));return /^https?:$/.test(u.protocol)?u.href:"#"}catch(_){return"#"}}
function stamp(i){return Number(i.ts)||Date.parse(i.published_at)||0}
function ago(i){
 const s=Math.max(0,Math.floor((Date.now()-stamp(i))/1000));
 if(s<60)return s<10?"just now":s+"s ago";
 if(s<3600)return Math.floor(s/60)+"m ago";
 if(s<86400)return Math.floor(s/3600)+"h ago";
 return Math.floor(s/86400)+"d ago";
}
function phDate(i){return new Date(stamp(i)).toLocaleString("en-PH",{timeZone:"Asia/Manila",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})+" PHT"}
// Real publisher photos take priority. If a source (especially Google News)
// cannot provide one, every story uses our own polished editorial cover.
const CELEB_FALLBACK="/assets/celebrity-cover.svg";
const photoCache=new Map();
let celebObserver=null;
function directPublisher(article){
 try{
  const url=new URL(article);
  return /^https?:$/.test(url.protocol)&&!/(^|\.)news\.google\.com$/i.test(url.hostname);
 }catch(_){return false}
}
function refForArticle(article){
 // Original article links are ASCII URLs; use URL-safe base64 as supported by the API.
 return btoa(article).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function showCelebrityCover(img){
 if(!img)return;
 img.onerror=null;
 img.dataset.celebNeedsOg="0";
 img.dataset.celebCover="1";
 img.style.display="block";
 if(!img.src.endsWith(CELEB_FALLBACK))img.src=CELEB_FALLBACK;
}
async function findPublisherPhoto(article){
 if(!directPublisher(article))return"";
 if(photoCache.has(article))return photoCache.get(article);
 const pending=fetch("/api/celebrity-image?ref="+refForArticle(article),{cache:"force-cache"})
  .then(async r=>{
   if(!r.ok)return"";
   const data=await r.json();
   return data&&data.ok&&/^https?:\/\//i.test(data.image)?data.image:"";
  }).catch(()=>"");
 photoCache.set(article,pending);
 return pending;
}
window.mxCelebrityImageFallback=async function(img){
 if(!img||!img.dataset||img.dataset.celebMetaRunning==="1")return;
 const article=safeUrl(img.dataset.celebUrl||"");
 if(!directPublisher(article)||img.dataset.celebMetaTried==="1"){showCelebrityCover(img);return;}
 img.dataset.celebMetaTried="1";
 img.dataset.celebMetaRunning="1";
 try{
  const photo=await findPublisherPhoto(article);
  if(!img.isConnected)return;
  if(photo&&photo!==img.src){
   img.onerror=function(){showCelebrityCover(this)};
   img.src=photo;
   img.style.display="block";
   img.dataset.celebCover="0";
  }else showCelebrityCover(img);
 }catch(_){showCelebrityCover(img)}
 finally{img.dataset.celebMetaRunning="0"}
};
function scheduleCelebrityImage(img){
 if(!img||img.dataset.celebQueued==="1")return;
 img.dataset.celebQueued="1";
 if(celebObserver){celebObserver.observe(img)}
 else window.mxCelebrityImageFallback(img);
}
function hydrateCelebrityImages(root){
 const scope=root||stage;
 const imgs=[...(scope.matches&&scope.matches('img[data-celeb-needs-og="1"]')?[scope]:[]),
  ...scope.querySelectorAll('img[data-celeb-needs-og="1"]')];
 imgs.forEach(scheduleCelebrityImage);
}
if("IntersectionObserver" in window){
 celebObserver=new IntersectionObserver(entries=>{
  for(const entry of entries){
   if(!entry.isIntersecting)continue;
   celebObserver.unobserve(entry.target);
   if(entry.target.dataset.celebNeedsOg==="1")window.mxCelebrityImageFallback(entry.target);
  }
 },{rootMargin:"450px 0px"});
}
window.mxCelebrityQueueImages=hydrateCelebrityImages;
// Also hydrate Celebrity tiles restored from All News cache before this script loaded.
hydrateCelebrityImages(document);
function image(i){
 const article=safeUrl(i.url);
 const trustedPhoto=i.image&&/^https?:\/\//i.test(i.image)?i.image:"";
 const needsOg=!trustedPhoto&&directPublisher(article);
 const src=trustedPhoto||CELEB_FALLBACK;
 return '<div class="celeb-photo"><span class="celeb-photo-mark">✦</span>'+
   '<img src="'+esc(src)+'" data-celeb-url="'+esc(article)+'" data-celeb-needs-og="'+(needsOg?"1":"0")+'" alt="" loading="lazy" referrerpolicy="no-referrer" onload="this.parentElement.classList.add(\'has-real-image\')" onerror="window.mxCelebrityImageFallback?window.mxCelebrityImageFallback(this):this.style.display=\'none\'">'+
   '</div>';
}

function featureCard(i,small){
 return '<a class="'+(small?"celeb-mini":"celeb-feature")+'" href="'+esc(safeUrl(i.url))+'" target="_blank" rel="noopener noreferrer" aria-label="'+esc(i.headline)+'">'+
   image(i)+'<div class="celeb-copy">'+
   '<span class="celeb-tag">✦ &nbsp; Celebrity</span>'+
   '<h2>'+esc(i.headline)+'</h2>'+
   (small?"":'<p>'+esc(i.summary||"The latest from "+(i.source||"entertainment news")+".")+'</p>')+
   '<div class="celeb-caption"><span>'+esc(i.source||"Entertainment")+' <span class="date">· '+esc(ago(i))+'</span></span><span class="celeb-read">READ STORY ↗</span></div></div></a>';
}

function sliderAnchor(i){
 return '<a class="celeb-slide-link" id="mxCelebritySlideLink" href="'+esc(safeUrl(i.url))+'" target="_blank" rel="noopener noreferrer" aria-label="'+esc(i.headline)+'">'+
   image(i)+'<div class="celeb-copy"><span class="celeb-tag">✦ &nbsp; Celebrity</span>'+
   '<h2>'+esc(i.headline)+'</h2><p>'+esc(i.summary||"Read the original entertainment report.")+'</p>'+
   '<div class="celeb-caption"><span>'+esc(i.source||"Entertainment")+' <span class="date">· '+esc(ago(i))+'</span></span>'+
   '<span class="celeb-read">READ STORY ↗</span></div></div></a>';
}
function sliderMarkup(i,total,current){
 return '<div class="celeb-feature celeb-slider" id="mxCelebritySlider">'+sliderAnchor(i)+
   '<button class="celeb-slide-arrow prev" type="button" data-direction="-1" aria-label="Previous celebrity story">‹</button>'+
   '<button class="celeb-slide-arrow next" type="button" data-direction="1" aria-label="Next celebrity story">›</button>'+
   '<span class="celeb-slide-counter" id="mxCelebritySlideCounter">'+(current+1)+' / '+total+'</span></div>';
}
function stopSlider(){if(state.slideTimer){clearInterval(state.slideTimer);state.slideTimer=null}}
function startSlider(){
 stopSlider();
 if(!active()||state.slideItems.length<2||document.hidden)return;
 state.slideTimer=setInterval(()=>slideTo(state.slideIndex+1,1),5000);
}
function slideTo(n,dir=1){
 const pool=state.slideItems;
 if(!active()||!pool.length)return;
 state.slideIndex=(n%pool.length+pool.length)%pool.length;
 const link=document.getElementById("mxCelebritySlideLink");
 const counter=document.getElementById("mxCelebritySlideCounter");
 if(!link||!counter)return;
 link.outerHTML=sliderAnchor(pool[state.slideIndex]);
 counter.textContent=(state.slideIndex+1)+" / "+pool.length;
 const next=document.getElementById("mxCelebritySlideLink");
 hydrateCelebrityImages();
 if(next&&next.animate&&!(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)){
   next.animate([{opacity:.45,transform:"translateX("+(dir<0?"-18px":"18px")+")"},{opacity:1,transform:"translateX(0)"}],
    {duration:320,easing:"ease-out"});
 }
}
function attachSlider(){
 const slider=document.getElementById("mxCelebritySlider");if(!slider)return;
 slider.querySelectorAll("[data-direction]").forEach(b=>{
  b.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();const d=Number(b.dataset.direction);slideTo(state.slideIndex+d,d);startSlider()});
 });
 slider.addEventListener("mouseenter",stopSlider);
 slider.addEventListener("mouseleave",startSlider);
 let startX=0,startY=0;
 slider.addEventListener("touchstart",e=>{const t=e.touches[0];if(t){startX=t.clientX;startY=t.clientY;stopSlider()}},{passive:true});
 slider.addEventListener("touchend",e=>{const t=e.changedTouches[0];if(t){const dx=t.clientX-startX,dy=t.clientY-startY;if(Math.abs(dx)>48&&Math.abs(dx)>Math.abs(dy)*1.3){slideTo(state.slideIndex+(dx<0?1:-1),dx<0?1:-1)}}startSlider()},{passive:true});
}
document.addEventListener("visibilitychange",()=>{if(document.hidden)stopSlider();else if(active())startSlider()});

function articleCard(i){
 return '<a class="celeb-card" href="'+esc(safeUrl(i.url))+'" target="_blank" rel="noopener noreferrer" aria-label="'+esc(i.headline)+'">'+image(i)+
 '<div class="celeb-card-body"><div class="celeb-card-top"><span>✦ Celebrity</span><span class="mx-celeb-age" data-ts="'+stamp(i)+'">'+esc(ago(i))+'</span></div>'+
 '<h3>'+esc(i.headline)+'</h3><div class="celeb-card-bottom"><span>'+esc(i.source||"Entertainment")+' · '+esc(phDate(i))+'</span><span class="celeb-card-arrow">›</span></div></div></a>';
}
function active(){return !stage.hidden}
function filtered(){const q=String(searchEl&&searchEl.value||"").trim().toLowerCase();
 return state.items.filter(i=>!q||(i.headline+" "+i.source).toLowerCase().includes(q));
}
// Elegant, sourced Philippine celebrity headlines; uses the existing 45s desk feed.
const buzzBar=document.getElementById("mxCelebrityBuzz");
const buzzStrip=document.getElementById("mxCelebrityBuzzStrip");
let buzzSignature="";
const BUZZ_CACHE_KEY="mxCelebrityBuzzLatestPHV2";
let lastBuzzStories=[];
function readBuzzCache(){
 try{
  const saved=JSON.parse(localStorage.getItem(BUZZ_CACHE_KEY)||"null");
  if(saved&&Array.isArray(saved.items)&&Date.now()-Number(saved.saved)<72*3600000){
   return saved.items.filter(i=>i&&i.market==="PH"&&stamp(i)>0&&safeUrl(i.url)!=="#").slice(0,12);
  }
 }catch(_){}
 return[];
}
lastBuzzStories=readBuzzCache();
function renderCelebrityBuzz(){
 if(!buzzBar||!buzzStrip||!active())return;
 // Never hide the bar during fetches, API failures or transient empty feeds.
 buzzBar.hidden=false;
 const ph=state.items.filter(i=>i.market==="PH"&&safeUrl(i.url)!=="#"&&stamp(i)>0)
   .sort((a,b)=>stamp(b)-stamp(a));
 const actualNews=ph.filter(i=>!/youLOL rewind|full episode|throwback|replay|episode \d+|music video|trailer/i.test(i.headline||""));
 let picked=(actualNews.length>=5?actualNews:ph).slice(0,12);
 if(picked.length){
  lastBuzzStories=picked;
  try{localStorage.setItem(BUZZ_CACHE_KEY,JSON.stringify({saved:Date.now(),items:picked}))}catch(_){}
 }else{
  picked=lastBuzzStories.length?lastBuzzStories:readBuzzCache();
 }
 if(!picked.length){
  if(!buzzStrip.querySelector(".celeb-buzz-run")){
   buzzStrip.style.animation="none";
   if(!buzzStrip.children.length){
    buzzStrip.innerHTML='<span class="celeb-buzz-wait">✦ &nbsp; Checking the latest Philippine celebrity headlines… &nbsp; ✧</span>';
   }
  }
  return;
 }
 const sig=picked.map(i=>i.url+"|"+stamp(i)).join("||");
 if(sig===buzzSignature&&buzzStrip.querySelector(".celeb-buzz-run"))return;
 buzzSignature=sig;
 buzzStrip.style.animation="";
 const run=(duplicate)=>'<div class="celeb-buzz-run"'+(duplicate?' aria-hidden="true"':"")+'>'+
  picked.map(i=>'<a class="celeb-buzz-item" href="'+esc(safeUrl(i.url))+
   '" target="_blank" rel="noopener noreferrer"'+(duplicate?' tabindex="-1"':"")+'>'+
   '<span class="buzz-sparkle" aria-hidden="true">✦</span>'+
   '<span class="buzz-title">'+esc(i.headline||"Celebrity update")+'</span>'+
   '<span class="buzz-source">'+esc(i.source||"PH Showbiz")+'</span>'+
   '<span class="buzz-time" data-buzz-ts="'+stamp(i)+'">'+esc(ago(i))+'</span>'+
   '<span class="buzz-sep" aria-hidden="true">✧</span></a>').join("")+'</div>';
 buzzStrip.innerHTML=run(false)+run(true);
 // The duplicate is exactly the same length, so -50% gives a seamless loop.
 const headlineLength=picked.reduce((n,i)=>n+String(i.headline||"").length,0);
 buzzStrip.style.setProperty("--celeb-buzz-time",Math.min(140,Math.max(45,headlineLength*0.09))+"s");
}
function updateBuzzAges(){
 if(!buzzBar||buzzBar.hidden)return;
 buzzStrip.querySelectorAll("[data-buzz-ts]").forEach(el=>{
  const ts=Number(el.getAttribute("data-buzz-ts")||0);
  if(ts)el.textContent=ago({ts});
 });
}

function render(){
 if(!active())return;
 renderCelebrityBuzz();
 const items=filtered();
 const available=new Set(items.map(i=>safeUrl(i.url)));
 let slides=(state.featured||[]).filter(i=>available.has(safeUrl(i.url))).slice(0,10);
 // The visible hero must contain ten distinct stories when ten exist.
 // A recently deployed API may temporarily reference older feature links,
 // so fill vacancies with verified PH stories, never invented duplicates.
 const usedSlides=new Set(slides.map(i=>safeUrl(i.url)));
 const phUsed=()=>slides.filter(i=>i.market==="PH").length;
 const target=Math.min(10,items.length),minPH=Math.ceil(target*0.8);
 const local=items.filter(i=>i.market==="PH"&&!usedSlides.has(safeUrl(i.url)));
 const world=items.filter(i=>i.market==="WORLD"&&!usedSlides.has(safeUrl(i.url)));
 while(slides.length<target){
  const choose=(phUsed()<minPH||!world.length)?local.shift():(world.shift()||local.shift());
  const next=choose||local.shift()||world.shift();
  if(!next)break;
  const url=safeUrl(next.url);
  if(usedSlides.has(url))continue;
  slides.push(next);usedSlides.add(url);
 }
 const previous=state.slideItems[state.slideIndex]?safeUrl(state.slideItems[state.slideIndex].url):"";
 state.slideItems=slides;
 const keepIndex=slides.findIndex(i=>safeUrl(i.url)===previous);
 state.slideIndex=keepIndex>=0?keepIndex:0;
 const lead=slides[state.slideIndex];
 const slideUrls=new Set(slides.map(i=>safeUrl(i.url)));
 const side=items.filter(i=>!slideUrls.has(safeUrl(i.url))).slice(0,2);
 const used=new Set(slides.concat(side).map(i=>safeUrl(i.url)));
 const rest=items.filter(i=>!used.has(safeUrl(i.url)));
 if(!lead){
  stopSlider();
  featureRoot.innerHTML='<div class="celeb-placeholder"><strong>'+(state.loading?"The spotlight is loading ✦":"No new headlines yet")+'</strong>'+
   esc(state.error||"Finding fresh, published celebrity stories from entertainment sources…")+'</div>';
  newsRoot.innerHTML="";return;
 }
 featureRoot.innerHTML=sliderMarkup(lead,slides.length,state.slideIndex)+'<div class="celeb-side">'+side.map(i=>featureCard(i,true)).join("")+'</div>';
 newsRoot.innerHTML=rest.slice(0,45).map(articleCard).join("");
 hydrateCelebrityImages();attachSlider();startSlider();
}
function cacheRestore(){
 try{
  const data=JSON.parse(localStorage.getItem("mxCelebrityV1")||"null");
  if(!data||Date.now()-data.saved>2*3600000||!data.items||!data.items.length)return;
  state.items=data.items.filter(i=>Date.now()-stamp(i)<48*3600000);
  state.featured=data.featured||[];
  state.sourceCount=data.sourceCount||0;state.loaded=state.items.length>0;state.stale=true;
 }catch(_){}
}
async function refresh(){
 if(state.loading)return;
 state.loading=true;if(active()&&!state.loaded)render();
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
 try{
  const r=await fetch("/api/celebrities?t="+Date.now(),{cache:"no-store",signal:controller.signal});
  const data=await r.json();
  if(!r.ok||!data.ok||!Array.isArray(data.items)||!data.items.length)throw Error(data.error||"Source connection unavailable");
  const filteredItems=data.items.filter(i=>stamp(i)>0&&Date.now()-stamp(i)<=48*3600000);
  const signature=filteredItems.map(i=>i.url+"|"+i.ts).join("||");
  const changed=state.signature!==signature;
  state.items=filteredItems;state.featured=Array.isArray(data.featured)?data.featured:[];
  state.sourceCount=Number(data.source_count)||0;state.checkedAt=data.checked_at||"";
  state.stale=!!data.stale;state.loaded=true;state.loading=false;state.error="";
  state.signature=signature;
  try{localStorage.setItem("mxCelebrityV1",JSON.stringify({saved:Date.now(),items:state.items,featured:state.featured,sourceCount:state.sourceCount}))}catch(_){}
  if(changed||!newsRoot.children.length)render();
 }catch(e){
  state.loading=false;state.error="Published entertainment sources are reconnecting. New stories will appear automatically.";
  if(active())render();
 }finally{clearTimeout(timer)}
}
bar.addEventListener("click",function(e){
 const b=e.target.closest("[data-cat]");if(!b)return;
 if(b.dataset.cat==="Celebrity"){
  e.preventDefault();e.stopImmediatePropagation();
  if(typeof window.mxNewsPersistCategory==="function")window.mxNewsPersistCategory("Celebrity");
  bar.querySelectorAll(".cat").forEach(x=>x.classList.remove("active"));
  tab.classList.add("active");document.body.classList.add("mx-celeb-active");
  stage.hidden=false;render();refresh();
  return;
 }
 stopSlider();stage.hidden=true;document.body.classList.remove("mx-celeb-active");
},true);
if(searchEl)searchEl.addEventListener("input",()=>{if(active())render()});
cacheRestore();
setInterval(()=>{if(active())refresh()},45000);
setInterval(updateBuzzAges,30000);
setInterval(()=>{if(!active())return;stage.querySelectorAll(".mx-celeb-age").forEach(el=>{
 const time=Number(el.getAttribute("data-ts"));if(time)el.textContent=ago({ts:time});
})},30000);
if(typeof window.mxNewsPreferredCategory==="function"&&window.mxNewsPreferredCategory()==="Celebrity")tab.click();
})();
