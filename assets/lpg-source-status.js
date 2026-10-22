/* MX Fuel LPG freshness: distinguish verified brand quotes from carried-forward references.
   This widget never guesses prices or changes the numeric cards. */
(function(){
 'use strict';
 const section=document.getElementById('lpg');
 if(!section)return;
 const header=section.querySelector('.lpg-head');
 if(!header)return;
 const indicator=document.createElement('span');
 indicator.id='mxLpgStatus';
 indicator.className='mx-lpg-status is-loading';
 indicator.setAttribute('role','status');
 indicator.setAttribute('aria-live','polite');
 indicator.textContent='Checking LPG sources…';
 header.appendChild(indicator);
 const brands=['Regasco','Solane','Petron Gasul','SL Gas','Phoenix LPG','Total Gas'];
 let data=null,loading=false,lastRequest=0;
 const fmt=(iso)=>{
   const n=Date.parse(iso||'');
   return Number.isFinite(n)?new Intl.DateTimeFormat('en-PH',{
     timeZone:'Asia/Manila',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',hour12:true
   }).format(new Date(n))+' PHT':'date unavailable';
 };
 function render(){
  if(!data)return;
  const checked=data.checked_at||data.rendered_at||null;
  const verified=data.verified&&typeof data.verified==='object'?data.verified:{};
  const current=brands.filter(name=>verified[name]);
  const checkedMs=Date.parse(checked||'');
  const recent=Number.isFinite(checkedMs)&&Date.now()-checkedMs<=36*3600000&&Date.now()-checkedMs>=0;
  indicator.className='mx-lpg-status '+(recent&&current.length===6?'is-verified':'is-partial');
  indicator.textContent='Checked '+fmt(checked)+' · '+current.length+'/6 source-verified';
  indicator.title='Source check is separate from price publication. '+current.length+
    ' verified in the latest check; other brand amounts were carried forward and need dealer confirmation.';
  const cards=section.querySelectorAll('.lpg-card');
  for(const card of cards){
    const nameEl=card.querySelector('.lpg-name');
    const raw=(nameEl?.textContent||'').trim();
    const brand=brands.find(name=>raw.toLowerCase().includes(name.toLowerCase()));
    if(!brand)continue;
    const age=data.last_verified_at_by_brand?.[brand]||null;
    const sourceOK=!!verified[brand]&&recent;
    card.setAttribute('data-lpg-source-status',sourceOK?'verified':'reference');
    card.setAttribute('title',sourceOK?
      brand+' · source-verified on '+fmt(age||checked):
      brand+' · carried-forward reference price; verify with the distributor. Last confirmation: '+fmt(age));
  }
 }
 async function update(force=false){
  if(loading||(!force&&Date.now()-lastRequest<28*60000))return;
  loading=true;
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),14000);
  try{
   const r=await fetch('/data/gaswatch-lpg.json?t='+Date.now(),{cache:'no-store',signal:controller.signal});
   if(!r.ok)throw Error('LPG source HTTP '+r.status);
   const j=await r.json();
   if(!Array.isArray(j.lpg)||j.lpg.length!==6)throw Error('Incomplete source snapshot');
   data=j;render();
  }catch(e){
   if(!data){indicator.className='mx-lpg-status is-unavailable';indicator.textContent='LPG source check unavailable';}
   else{indicator.className='mx-lpg-status is-unavailable';indicator.textContent='Source unreachable · last check '+fmt(data.checked_at||data.rendered_at);}
  }finally{lastRequest=Date.now();loading=false;clearTimeout(timeout);}
 }
 const grid=document.getElementById('lpgGrid');
 if(grid)new MutationObserver(render).observe(grid,{childList:true});
 update(true);
 setInterval(()=>update(),30*60000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)update(true)});
 window.addEventListener('online',()=>update(true));
 window.addEventListener('focus',()=>update(true));
})();
