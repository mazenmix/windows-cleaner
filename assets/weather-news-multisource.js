/* Fresh-only Weather News. No old localStorage headlines or undated bootstrap. */
(function(){
 'use strict';
 const track=document.getElementById('weatherNewsTrack');
 const strip=document.getElementById('weatherNews');
 if(!track||!strip)return;
 const label=strip.querySelector('.weather-news-label');
 const ENDPOINT='/api/weather-news';
 const MAX_AGE=36*60*60*1000;
 const CACHE_KEY='mx.fuel.verifiedHeadlines.v1';
 const CACHE_MAX_AGE=12*60*1000;
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
 async function officialMessages(){
  try{
   const r=await fetch('/api/pagasa-live?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(9000)});
   if(!r.ok)throw Error('PAGASA status not verified');
   const data=await r.json();
   const cyclone=data?.cyclone,checked=data?.checked_at;
   const out=[];
   if(cyclone?.state==='active'&&cyclone?.active===true&&cyclone.name&&cyclone.issued_at){
    out.push({source:'PAGASA OFFICIAL',message:
      (cyclone.category||'Tropical cyclone')+' '+cyclone.name.toUpperCase()+
      ' · Cyclone Bulletin #'+(cyclone.bulletin_no||'—')+' · Issued '+stamp(cyclone.issued_at)});
   }else if(cyclone?.state==='clear'&&cyclone.active===false){
    out.push({source:'PAGASA OFFICIAL',message:
      'No active tropical cyclone currently confirmed inside the Philippine Area of Responsibility · Checked '+stamp(checked)});
   }
   if(data?.flood?.state==='active'){
    out.push({source:'PAGASA FLOOD',message:String(data.flood.summary||'Active river basin flood bulletin').slice(0,185)});
   }
   if(out.length&&checked)out.push({source:'SOURCE CHECK',message:'PAGASA advisory status checked '+stamp(checked)+' · New media headlines are being fetched'});
   return out;
  }catch{return []}
 }
 function offline(official=[],loading=false){
  lastArticles=[];
  status('WEATHER NEWS',false);
  // Keep the ticker visibly moving while making the source outage explicit.
  // Do not recycle old headlines or imply that a check produced new news.
  const notices=[
   {source:'WEATHER NEWS',message:loading?'Fetching the latest Philippine typhoon, storm and PAGASA news headlines…':'Fresh Philippine weather headlines temporarily unavailable. Checking multiple news publishers.'},
   ...official,
   {source:'WEATHER NEWS',message:loading?'Live source checks in progress. News ticker is already moving.':'Monitoring typhoons, floods, rain, PAGASA advisories, monsoon and weather warnings. Source checks continue.'}
  ];
  const signature=JSON.stringify(notices);
  if(lastSignature===signature&&track.childElementCount)return;
  lastSignature=signature;
  track.dataset.mode='waiting';
  const markup=notices.map(({source,message})=>'<span class="weather-news-item">'+
   '<span class="weather-news-source">'+escape(source)+'</span>'+
   '<span class="weather-news-headline">'+escape(message)+'</span>'+
   '<span class="weather-news-sep" aria-hidden="true">◆</span></span>').join('');
  track.style.animation='none';track.style.webkitAnimation='none';
  track.innerHTML=markup+markup;
  const viewport=track.parentElement;
  let copies=1;
  while(track.scrollWidth/2<viewport.clientWidth+80&&copies<8){
   copies++;track.innerHTML=markup.repeat(copies*2);
  }
  const seconds=Math.max(24,(track.scrollWidth/2)/95);
  void track.offsetWidth;
  track.style.animation='weatherNewsMarquee '+seconds+'s linear infinite';
  track.style.webkitAnimation='weatherNewsMarquee '+seconds+'s linear infinite';
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
  track.dataset.mode='news';
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
  if(busy||(!force&&Date.now()-lastRequest<30000))return;
  busy=true;
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),7000);
  try{
   const r=await fetch(ENDPOINT+'?t='+Date.now(),{signal:c.signal,cache:'no-store',headers:{accept:'application/json'}});
   if(!r.ok)throw Error('HTTP '+r.status);
   const data=await r.json();
   if(!data?.ok||!Array.isArray(data.items)||!data.items.length)throw Error('No verified news');
   render(data.items,data.live!==true);
   strip.dataset.lastChecked=String(data.checked_at||'');
   if(data.live===true)try{sessionStorage.setItem(CACHE_KEY,JSON.stringify({saved:Date.now(),items:data.items.slice(0,16)}))}catch{}
  }catch{offline(await officialMessages());}
  finally{clearTimeout(timer);busy=false;lastRequest=Date.now();}
 }
 // First frame never waits on network: show moving source-status text instantly.
 // A brief recent, originally verified, same-tab cache is explicitly labeled
 // UPDATING NEWS and replaced once a current RSS check finishes.
 let restored=false;
 try{
  const saved=JSON.parse(sessionStorage.getItem(CACHE_KEY)||'null');
  if(saved&&Date.now()-saved.saved<=CACHE_MAX_AGE&&Array.isArray(saved.items)){
   render(saved.items,true);
   status('UPDATING NEWS',false);
   restored=!!track.childElementCount;
  }
 }catch{}
 if(!restored)offline([],true);
 refresh(true);
 setInterval(()=>refresh(),35000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh(true)});
 window.addEventListener('focus',()=>refresh(true));
 window.addEventListener('online',()=>refresh(true));
})();
