/* Show GasWatch PH's six 11kg card prices, with no extra labels or status bar. */
(function(){
'use strict';
const names=['Regasco','Solane','Petron Gasul','SL Gas','Phoenix LPG','Total Gas'];
const grid=document.getElementById('lpgGrid');
if(!grid)return;
let latest=null,loading=false,last=0;
const compact=x=>String(x||'').trim().toLowerCase().replace(/\s+/g,' ');
const weight=()=>Number(document.querySelector('#lpg .weight.active')?.getAttribute('data-kg')||11);
function validate(list){
 if(!Array.isArray(list)||list.length!==6)return null;
 const map=new Map(list.map(x=>[compact(x.name),Number(x.price)]));
 if(map.size!==6||names.some(n=>!Number.isFinite(map.get(compact(n)))||map.get(compact(n))<500||map.get(compact(n))>3000))return null;
 return new Map(names.map(n=>[compact(n),map.get(compact(n))]));
}
function syncCards(){
 if(!latest||weight()!==11)return;
 const cards=Array.from(grid.querySelectorAll('.lpg-card'));
 if(!cards.length)return;
 const min=Math.min(...latest.values());
 for(const card of cards){
  const label=compact(card.querySelector('.lpg-name')?.textContent);
  const brand=names.find(n=>label===compact(n)||label.startsWith(compact(n)+' '));
  if(!brand)continue;
  const value=latest.get(compact(brand));
  const price=card.querySelector('.lpg-price');
  if(!price)continue;
  const visible=Number((price.textContent||'').replace(/[^0-9.]/g,''));
  if(Math.abs(visible-value)>0.001){
   const unit=document.createElement('small');
   unit.textContent='PHP';
   price.replaceChildren(unit,document.createTextNode(value.toLocaleString('en-US',{maximumFractionDigits:0})));
  }
  const cheapest=value===min;
  card.classList.toggle('cheapest',cheapest);
  let chip=card.querySelector('.cheapest-badge');
  if(cheapest){
   if(!chip){
    chip=document.createElement('span');
    chip.className='cheapest-badge';
    chip.textContent='Cheapest';
    card.appendChild(chip);
   }
  }else if(chip)chip.remove();
  // Remove previously inserted source labels without touching pricing.
  card.querySelectorAll('.mx-lpg-freshness,.mx-lpg-source-pill').forEach(e=>e.remove());
 }
 const obsolete=document.getElementById('mxLpgStatus');
 if(obsolete)obsolete.remove();
}
async function json(url,timeout=12000){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeout);
 try{
  const response=await fetch(url,{cache:'no-store',signal:controller.signal});
  if(!response.ok)throw Error('HTTP '+response.status);
  return await response.json();
 }finally{clearTimeout(timer)}
}
async function refresh(force=false){
 if(loading||(!force&&Date.now()-last<55000)||!navigator.onLine)return;
 loading=true;
 try{
  let data;
  try{
   data=await json('/api/lpg-live?t='+Date.now());
   if(!data.ok)throw Error('Source unavailable');
  }catch(_){
   const snapshot=await json('/data/gaswatch-mirror-lpg.json?t='+Date.now());
   data={brands:snapshot.brands};
  }
  const verified=validate(data.brands);
  if(!verified)throw Error('Incomplete GasWatch source');
  latest=verified;
  syncCards();
 }catch(_){syncCards();}
 finally{loading=false;last=Date.now()}
}
let queued=false;
new MutationObserver(()=>{
 if(queued)return;
 queued=true;
 queueMicrotask(()=>{queued=false;syncCards()});
}).observe(grid,{childList:true,subtree:true});
document.querySelectorAll('#lpg .weight').forEach(button=>
 button.addEventListener('click',()=>setTimeout(syncCards,30)));
document.getElementById('refreshAll')?.addEventListener('click',()=>refresh(true));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh(true)});
window.addEventListener('focus',()=>refresh(true));
window.addEventListener('online',()=>refresh(true));
setInterval(()=>{if(!document.hidden)refresh()},60000);
refresh(true);
})();
