/* Verified PAGASA typhoon name in every MX Fuel header. No invented or cached alerts. */
(function(){
 'use strict';
 const path='/api/pagasa-live';
 const brand=document.querySelector('.header .navbar > .brand')||document.querySelector('.topbar .nav > .brand');
 if(!brand)return;
 const isNews=brand.matches('a.brand');
 if(!isNews&&!brand.querySelector('.brandcopy')){
  const copy=document.createElement('span');copy.className='mx-global-brand-text';
  while(brand.firstChild)copy.appendChild(brand.firstChild);
  brand.appendChild(copy);
 }
 if(!isNews)brand.classList.add('mx-global-brand');
 const badge=document.createElement('a');
 badge.className='mx-global-typhoon-alert';
 badge.href='/weather-now.html';
 badge.hidden=true;badge.setAttribute('aria-label','Official PAGASA typhoon alert: view weather details');
 badge.innerHTML='<span class="mx-global-storm-icon" aria-hidden="true"></span><span class="mx-global-typhoon-copy"><span class="mx-global-typhoon-eyebrow">TYPHOON ALERT</span><span class="mx-global-typhoon-name"></span></span>';
 if(isNews)brand.insertAdjacentElement('afterend',badge);
 else brand.appendChild(badge);
 function cleanWeatherCard(){
  const card=document.getElementById('mxTyphoonAlertCard');
  if(!card)return;
  card.querySelector('.mx-tc-source')?.remove();
  card.querySelector('.mx-tc-alert-footer a')?.remove();
 }
 const hero=document.getElementById('weatherHero');
 if(hero){
  const observer=new MutationObserver(cleanWeatherCard);
  observer.observe(hero,{childList:true});
  cleanWeatherCard();
 }
 let loading=false,lastFetch=0;
 const nameEl=badge.querySelector('.mx-global-typhoon-name');
 function show(cyclone){
  // Restrict the global ribbon to current PAGASA Typhoon / Super Typhoon alerts.
  const active=cyclone&&cyclone.state==='active'&&cyclone.active===true;
  const typhoon=active&&/\btyphoon\b/i.test(String(cyclone.category||''));
  const label=String(cyclone?.name||'').trim();
  const valid=typhoon&&label.length>1&&label.length<55;
  if(!valid){badge.hidden=true;nameEl.textContent='';return;}
  nameEl.textContent=label.toUpperCase();
  badge.hidden=false;
  badge.title=(cyclone.category||'Typhoon')+' '+label+' · PAGASA Bulletin #'+(cyclone.bulletin_no||'—');
 }
 async function update(force=false){
  if(loading||(!force&&Date.now()-lastFetch<45000))return;
  loading=true;
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),14000);
  try{
   const r=await fetch(path+'?t='+Date.now(),{cache:'no-store',signal:controller.signal});
   if(!r.ok)throw Error('PAGASA status HTTP '+r.status);
   const data=await r.json();
   if(!data||data.ok!==true)throw Error('No verified PAGASA response');
   show(data.cyclone);
  }catch{
   // Never carry an unverified warning over as if it were live.
   show(null);
  }finally{
   lastFetch=Date.now();loading=false;clearTimeout(timeout);
  }
 }
 update(true);
 setInterval(()=>update(),60000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)update(true)});
 window.addEventListener('focus',()=>update(true));
 window.addEventListener('online',()=>update(true));
})();
