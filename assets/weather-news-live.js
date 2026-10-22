/* Fresh-only Weather News. No old localStorage headlines or undated bootstrap. */
(function(){
 'use strict';
 const track=document.getElementById('weatherNewsTrack');
 const strip=document.getElementById('weatherNews');
 if(!track||!strip)return;
 const label=strip.querySelector('.weather-news-label');
 const ENDPOINT='/api/weather-news';
 const MAX_AGE=36*60*60*1000;
 let busy=false,lastRequest=0,lastSignature='',lastArticles=[];
 const escape=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const url=s=>{try{const u=new URL(s,location.href);return u.protocol==='https:'||u.protocol==='http:'?u.href:'#'}catch{return '#'}};
 const stamp=v=>{
  const n=Date.parse(v||'');if(!Number.isFinite(n))return 'Unverified date';
  return new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(n))+' PHT';
 };
 function status(text,live){
  if(label){label.textContent=text;label.dataset.live=live?'1':'0';label.title=live?'Published RSS headlines — checked every 60 seconds':'News publication data could not be verified in real time';}
 }
 function offline(){
  lastSignature='';lastArticles=[];
  status('NEWS CHECK','');
  track.style.animation='none';
  track.innerHTML='<span class="weather-news-item"><span class="weather-news-source">PAGASA / MEDIA</span>'+
   '<span class="weather-news-headline">Fresh weather headlines temporarily unavailable. Automatic checks continue every minute.</span>'+
   '<span class="weather-news-sep" aria-hidden="true">◆</span></span>';
 }
 function render(items,stale=false){
  const now=Date.now();
  const recent=(Array.isArray(items)?items:[]).filter(x=>{
   const t=Date.parse(x.published_at||'');
   return Number.isFinite(t)&&t>=now-MAX_AGE&&t<=now+20*60000&&x.headline&&x.url;
  }).sort((a,b)=>Date.parse(b.published_at)-Date.parse(a.published_at)).slice(0,16);
  if(!recent.length){offline();return;}
  const signature=String(stale)+recent.map(x=>[x.source,x.headline,x.published_at].join('|')).join('||');
  status(stale?'NEWS DELAYED':'WEATHER NEWS',!stale);
  if(lastSignature===signature&&track.childElementCount)return;
  lastSignature=signature;lastArticles=recent;
  const markup=recent.map(x=>'<a class="weather-news-item" href="'+escape(url(x.url))+'" target="_blank" rel="noopener noreferrer">'+
   '<span class="weather-news-source">'+escape(x.source||'NEWS')+'</span>'+
   '<span class="weather-news-headline">'+escape(x.headline)+'</span>'+
   '<time class="weather-news-age" datetime="'+escape(x.published_at)+'">'+escape(stamp(x.published_at))+'</time>'+
   '<span class="weather-news-sep" aria-hidden="true">◆</span></a>').join('');
  track.style.animation='none';track.style.webkitAnimation='none';
  track.innerHTML=markup+markup;
  // Repeat matching halves until they cover the available viewport seamlessly.
  const viewport=track.parentElement;let copies=1;
  while(track.scrollWidth/2<(viewport.clientWidth+80)&&copies<8){
   copies++;track.innerHTML=markup.repeat(copies*2);
  }
  const distance=track.scrollWidth/2;
  const duration=Math.max(17,distance/98)+'s';
  track.style.animation='';track.style.webkitAnimation='';
  track.style.animationDuration=duration;track.style.webkitAnimationDuration=duration;
 }
 async function refresh(force=false){
  if(busy||(!force&&Date.now()-lastRequest<45000))return;
  busy=true;
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),11000);
  try{
   const r=await fetch(ENDPOINT+'?t='+Date.now(),{signal:c.signal,cache:'no-store',headers:{accept:'application/json'}});
   if(!r.ok)throw Error('HTTP '+r.status);
   const data=await r.json();
   if(!data?.ok||!Array.isArray(data.items)||!data.items.length)throw Error('No verified news');
   render(data.items,data.live!==true);
   strip.dataset.lastChecked=String(data.checked_at||'');
  }catch{offline();}
  finally{clearTimeout(timer);busy=false;lastRequest=Date.now();}
 }
 status('NEWS CHECK','');
 refresh(true);
 setInterval(()=>refresh(),60000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh(true)});
 window.addEventListener('focus',()=>refresh(true));
 window.addEventListener('online',()=>refresh(true));
})();
