/* MX Fuel: cross-section refresh watchdog.
   Existing section-specific live timers remain primary (typically 60 seconds).
   This adds recovery after tab suspension/network return and a low-frequency
   fallback without reloading the page or inventing new source data. */
(function(){
 'use strict';
 const pathname=location.pathname.replace(/\/$/,'');
 const route=pathname.endsWith('/weather-now')||pathname.endsWith('/weather-now.html')?'weather':
             pathname.endsWith('/daily-cost-watch')||pathname.endsWith('/daily-cost-watch.html')?'daily':
             pathname===''||pathname.endsWith('/index.html')?'home':'news';
 // The newsroom controls its own continuous API polling and media carousel.
 if(route==='news')return;
 const selector=route==='weather'?'#refreshWeather':'#refreshAll';
 const WATCHDOG_MS=300000,RESUME_MIN_MS=60000;
 let lastTriggered=Date.now(),busy=false;
 function trigger(force){
   if(document.hidden||!navigator.onLine||busy)return;
   if(Date.now()-lastTriggered<(force?RESUME_MIN_MS:WATCHDOG_MS))return;
   const button=document.querySelector(selector);
   if(!button||button.disabled||button.getAttribute('aria-busy')==='true')return;
   lastTriggered=Date.now();busy=true;
   // Reuse native per-page in-place refresh logic; never do a full page reload.
   try{button.click();}
   finally{setTimeout(()=>{busy=false;},2500);}
 }
 setInterval(()=>trigger(false),60000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)trigger(true)});
 window.addEventListener('focus',()=>trigger(true));
 window.addEventListener('online',()=>trigger(true));
 window.addEventListener('pageshow',e=>{if(e.persisted)trigger(true)});
})();
