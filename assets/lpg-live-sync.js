/* MX LPG one-minute source watcher; never turn last-known prices into live quotes. */
(function(){
'use strict';
const grid=document.getElementById('lpgGrid'),head=document.querySelector('#lpg .lpg-head');
if(!grid||!head)return;
const names=['Regasco','Solane','Petron Gasul','SL Gas','Phoenix LPG','Total Gas'];
const clean=s=>String(s||'').toLowerCase().replace(/\s+/g,' ').trim();
const stamp=s=>{
 const d=new Date(s||'');
 return Number.isFinite(+d)?new Intl.DateTimeFormat('en-US',{
  timeZone:'Asia/Manila',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'
 }).format(d)+' PHT':'not verified';
};
const verified=q=>['official-live','official-snapshot','doe-monitored'].includes(q);
let state=null,busy=false,last=0;
let label=document.getElementById('mxLpgStatus');
if(!label){label=document.createElement('span');label.id='mxLpgStatus';head.appendChild(label)}
label.style.cssText='font-size:10px;border:1px solid #775f32;color:#e4bd7d;border-radius:20px;padding:7px 10px;line-height:1.5;margin-inline-start:auto';
function currentWeight(){return Number(document.querySelector('#lpg .weight.active')?.dataset.kg||'11')}
function paint(){
 if(!state?.brands?.length)return;
 const data=new Map(state.brands.map(x=>[clean(x.name),x])),eleven=currentWeight()===11;
 for(const card of grid.querySelectorAll('.lpg-card')){
  const heading=clean(card.querySelector('.lpg-name')?.textContent);
  const brand=names.find(n=>heading.includes(clean(n)));
  const row=data.get(clean(brand));
  if(!row)continue;
  const node=card.querySelector('.lpg-price');
  const p=Number(row.price);
  if(eleven&&node&&Number.isFinite(p)&&p>=500&&p<=3000){
   const number=String(Math.round(p));
   const value=(node.textContent||'').replace(/[^0-9]/g,'');
   if(value!==number){
    const small=node.querySelector('small')||document.createElement('small');
    small.textContent='PHP';
    node.replaceChildren(small,document.createTextNode(p.toLocaleString('en-US')));
   }
  }
  let chip=card.querySelector('.mx-lpg-freshness');
  if(!chip){
   chip=document.createElement('span');chip.className='mx-lpg-freshness';
   chip.style.cssText='display:inline-block;margin-top:6px;font-size:9px;font-weight:750';
   card.appendChild(chip);
  }
  const kind=!eleven?'11kg SOURCE ONLY':row.quality==='official-live'?'OFFICIAL LIVE':
   row.quality==='doe-monitored'?'DOE MONITORED':
   row.quality==='official-snapshot'?'LAST VERIFIED':'REFERENCE';
  if(chip.textContent!==kind)chip.textContent=kind;
  chip.style.color=verified(row.quality)?'#70edb5':'#e2bd80';
  const hint=brand+' · '+kind+' · source '+stamp(row.verified_at)+
   (row.source_period?' · '+row.source_period:'')+
   (row.source_url?' · '+row.source_url:'')+
   (!eleven?' · 22/50kg not separately sourced':'');
  if(card.title!==hint)card.title=hint;
  card.dataset.lpgSourceStatus=verified(row.quality)?'verified':'reference';
 }
 const count=state.brands.filter(x=>verified(x.quality)).length;
 const live=state.brands.filter(x=>x.quality==='official-live').length;
 const newStatus='Checked '+stamp(state.checked_at)+' · '+count+'/6 source-verified'+
  (live?' · '+live+' direct quotes':'')+
  (state.source_error?' · some sources unavailable':'');
 if(label.textContent!==newStatus)label.textContent=newStatus;
 label.title='Page refresh checks for changes; only brands with a verified source have current quotes.';
}
async function read(url,ms){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),ms);
 try{
  const response=await fetch(url,{cache:'no-store',signal:controller.signal});
  if(!response.ok)throw Error('HTTP '+response.status);
  return response.json();
 }finally{clearTimeout(timeout)}
}
async function refresh(force=false){
 if(busy||(!force&&Date.now()-last<55000)||!navigator.onLine)return;
 busy=true;
 try{
  const next=await read('/api/lpg-live?force='+(force?'1':'0')+'&t='+Date.now(),18500);
  if(!next.ok||!Array.isArray(next.brands)||next.brands.length!==6)throw Error('No complete LPG feed');
  state=next;
 }catch(error){
  // A static snapshot is historical, not a newly verified retailer quote.
  try{
   const fallback=await read('/data/gaswatch-lpg.json?t='+Date.now(),7000);
   if(!Array.isArray(fallback.lpg)||fallback.lpg.length!==6)throw Error('Bad snapshot');
   const dates=fallback.last_verified_at_by_brand||{},verifiedBrands=fallback.verified||{};
   state={checked_at:fallback.checked_at||fallback.rendered_at||null,source_error:String(error),
    brands:fallback.lpg.map(row=>{
     const s=dates[row.name]||(verifiedBrands[row.name]?fallback.checked_at:null);
     const time=Date.parse(s||''),fresh=Number.isFinite(time)&&Date.now()>=time&&Date.now()-time<72*3600000;
     const doe=String(verifiedBrands[row.name]||'').includes('DOE');
     return {name:row.name,price:row.price,verified_at:s,quality:fresh&&verifiedBrands[row.name]
      ?(doe?'doe-monitored':'official-snapshot'):'reference',
      source_url:doe?fallback.doe_document:(fallback.official_sources?.[row.name]||fallback.source_url),
      source_period:doe?fallback.doe_document_label:null};
    })};
  }catch(_){if(!state)label.textContent='LPG feed unavailable · showing last saved prices';}
 }finally{busy=false;last=Date.now();paint()}
}
new MutationObserver(paint).observe(grid,{childList:true});
document.querySelectorAll('#lpg .weight').forEach(b=>b.addEventListener('click',()=>setTimeout(paint,80)));
document.getElementById('refreshAll')?.addEventListener('click',()=>refresh(true));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh(true)});
window.addEventListener('focus',()=>refresh(true));
window.addEventListener('online',()=>refresh(true));
setInterval(()=>{if(!document.hidden)refresh()},60000);
refresh(true);
})();