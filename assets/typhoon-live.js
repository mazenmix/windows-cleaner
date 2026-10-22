/* MX Fuel · PAGASA verified cyclone watch. Data comes only from /api/pagasa-live. */
(function(){
 'use strict';
 const ENDPOINT='/api/pagasa-live';
 const bulletin='https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin';
 const hero=document.getElementById('weatherHero'),grid=document.getElementById('alertGrid'),risks=document.getElementById('riskGrid');
 if(!hero||!grid||!risks)return;
 let latest=null,updating=false,checked=0;
 const el=id=>document.getElementById(id);
 const text=(root,selector,value)=>{const node=root&&root.querySelector(selector);if(node&&node.textContent!==value)node.textContent=value};
 const format=(date)=>{if(!date)return '—';const n=Date.parse(date);if(!Number.isFinite(n))return '—';return new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(n))+' PHT'};
 const trim=(value,max=200)=>String(value||'').slice(0,max);
 const liveState=(c)=>c?.state==='active'||c?.state==='stale';
 function makeCard(){
  const section=hero.querySelector('.hero-grid'),control=section&&section.querySelector(':scope > .control-card');
  if(!control)return;
  const row=document.createElement('div');row.className='mx-tc-control-row';
  const card=document.createElement('aside');
  card.className='mx-tc-alert-card is-unknown';
  card.id='mxTyphoonAlertCard';card.setAttribute('aria-label','PAGASA tropical cyclone alert');
  card.innerHTML='<div class="mx-tc-alert-head"><span class="mx-tc-symbol" aria-hidden="true">▲</span><div><div class="mx-tc-overline">TYPHOON ALERT</div><div class="mx-tc-source">PAGASA · OFFICIAL BULLETIN</div></div></div>'+
   '<h3 class="mx-tc-alert-title" id="mxTyphoonAlertTitle">Checking PAGASA…</h3>'+
   '<p class="mx-tc-alert-summary" id="mxTyphoonAlertSummary">Retrieving the latest Philippine cyclone bulletin.</p>'+
   '<div class="mx-tc-alert-meta" id="mxTyphoonAlertMeta"></div>'+
   '<div class="mx-tc-alert-footer"><a href="'+bulletin+'" target="_blank" rel="noopener noreferrer">Official bulletin ↗</a><small id="mxTyphoonChecked">Checking…</small></div>';
  control.replaceWith(row);
  row.append(control,card);
  renderCard();
 }
 function ensure(){if(!el('mxTyphoonAlertCard'))makeCard();}
 function renderCard(){
  const card=el('mxTyphoonAlertCard');if(!card)return;
  const cyclone=latest?.cyclone||{state:'unavailable'};
  const active=liveState(cyclone),clear=cyclone.state==='clear',reported=cyclone.state==='reported'&&!!cyclone.name;
  const klass='mx-tc-alert-card '+(active?(cyclone.state==='stale'?'is-stale':'is-active'):clear?'is-clear mx-tc-verified-clear':reported?'is-unknown mx-tc-media-report':'is-unknown');
  if(card.className!==klass)card.className=klass;
  text(card,'.mx-tc-alert-title',active?(trim(cyclone.category,40)+' '+trim(cyclone.name,45)):clear?'No Typhoon for now':reported?'Reported Typhoon '+trim(cyclone.name,35):cyclone.state==='unavailable'?'PAGASA status unavailable':'Checking PAGASA…');
  let summary;
  if(active){
   const chunks=[cyclone.center?trim(cyclone.center,110):null,cyclone.movement?trim(cyclone.movement,90):null,
    Number.isFinite(cyclone.wind_kmh)?'Wind '+cyclone.wind_kmh+' km/h':null,
    Number.isFinite(cyclone.gust_kmh)?'Gusts '+cyclone.gust_kmh+' km/h':null].filter(Boolean);
   summary=(cyclone.state==='stale'?'Previous bulletin—new status awaiting verification. ':'')+(chunks.join(' · ')||'Active PAGASA tropical cyclone bulletin.');
  }else if(clear)summary='No active tropical cyclone currently reported inside the Philippine Area of Responsibility (PAR).';
  else if(reported)summary=trim(cyclone.headline||'Recent Philippine weather report',155)+' · '+trim(cyclone.reporting_source||'Philippine media',44)+' · PAGASA not yet verified.';
  else summary='The PAGASA source could not be verified. Do not assume conditions are clear; open the official bulletin.';
  text(card,'.mx-tc-alert-summary',summary);
  const meta=el('mxTyphoonAlertMeta');
  if(meta){
   meta.replaceChildren();
   const pills=active?['Bulletin #'+(cyclone.bulletin_no||'—'),'Issued '+format(cyclone.issued_at)]:
    clear?['PAR: CLEAR']:reported?['MEDIA REPORT · PAGASA PENDING','Published '+format(cyclone.published_at)]:['Verification pending'];
   for(const v of pills){const s=document.createElement('span');s.textContent=v;meta.appendChild(s);}
   if(clear&&latest?.checked_at&&Date.now()-Date.parse(latest.checked_at)<360000){const live=document.createElement('span');live.className='mx-tc-live-pill';const dot=document.createElement('i');dot.className='mx-tc-live-dot';dot.setAttribute('aria-hidden','true');live.append(dot,document.createTextNode('Live'));meta.append(live);}
  }
  text(card,'.mx-tc-alert-footer small',latest?.checked_at?'Checked '+format(latest.checked_at):'Verification pending');
 }
 function updateGrid(){
  const cards=grid.querySelectorAll(':scope > .alert-card');if(cards.length<3||!latest)return;
  const tc=latest.cyclone||{},th=latest.threat||{},fl=latest.flood||{},active=liveState(tc),clear=tc.state==='clear',reported=tc.state==='reported'&&!!tc.name;
  cards.forEach((card,i)=>{
   card.classList.toggle('mx-tc-red',active||(i===2&&fl.state==='active'));
   const label=card.querySelector('.tag');
   if(label){
    const value=i===0?(active?'TYPHOON':clear?'CLEAR':reported?'MEDIA REPORT':'UNVERIFIED'):i===1?(active?'TC ACTIVE':th.state==='available'?'UPDATED':'CHECK'):fl.state==='active'?'FLOOD WATCH':active?'TC WATCH':fl.state==='clear'?'CLEAR':'CHECK';
    if(label.textContent!==value)label.textContent=value;
    label.classList.toggle('red',active||(i===2&&fl.state==='active'));
   }
  });
  text(cards[0],'.alert-big',active?(trim(tc.category,40)+' '+trim(tc.name,50)):clear?'No Typhoon for now':reported?'Reported Typhoon '+trim(tc.name,35):'PAGASA verification unavailable');
  text(cards[0],'.alert-copy',active?[
   'PAGASA bulletin #'+(tc.bulletin_no||'—'), 'Issued '+format(tc.issued_at),
   tc.center,tc.movement,Number.isFinite(tc.wind_kmh)?'Wind '+tc.wind_kmh+' km/h':null,
   Number.isFinite(tc.gust_kmh)?'Gust '+tc.gust_kmh+' km/h':null,
   tc.state==='stale'?'Bulletin is old; confirm latest status.':null,
   'Checked '+format(latest.checked_at)].filter(Boolean).join(' · '):
   clear?'PAGASA confirmed no active cyclone inside PAR. Checked '+format(latest.checked_at):
   reported?trim(tc.headline||'Recent Philippine weather report',155)+' · PAGASA not yet verified.':
   'Latest official cyclone bulletin could not be verified. Do not treat this as an all-clear.');
  text(cards[1],'.alert-big',th.state==='available'?(th.period||'Current PAGASA 2-week outlook'):'2-week outlook unavailable');
  text(cards[1],'.alert-copy',th.state==='available'?
   'PAGASA cyclone formation guidance, not a confirmed landfall forecast. Checked '+format(latest.checked_at):
   'Unable to verify latest PAGASA threat forecast. Use the official link.');
  text(cards[2],'.alert-big',fl.state==='active'?'PAGASA flood bulletin active':fl.state==='clear'?'No active warnings in checked major-basin bulletins':'Flood advisory verification needed');
  text(cards[2],'.alert-copy',(trim(fl.summary||'Official flood bulletin check unavailable.',230))+
   ' · Checked '+format(latest.checked_at));
 }
 function updateRisk(){
  if(!latest)return;
  const c=latest.cyclone||{},risk=[...risks.querySelectorAll('.risk')].find(r=>/Typhoon\s*\/\s*PAR/i.test(r.querySelector('.k')?.textContent||''));
  if(!risk)return;
  const active=liveState(c),clear=c.state==='clear',reported=c.state==='reported';
  risk.classList.toggle('mx-tc-risk-alert',active);
  risk.classList.toggle('mx-tc-risk-unknown',!active&&!clear);
  text(risk,'.v',active?'ACTIVE':clear?'CLEAR':reported?'NEWS REPORTED':'UNVERIFIED');
  text(risk,'.sub',active?trim((c.category||'Cyclone')+' '+(c.name||'')+' · Bulletin '+(c.bulletin_no||'—'),110):clear?'Official PAGASA: no active cyclone within PAR':reported?'Recent cyclone news; PAGASA not yet verified':'Official bulletin currently unavailable');
 }
 function render(){ensure();renderCard();updateGrid();updateRisk();}
 async function refresh(force=false){
  if(updating)return;
  if(!force&&Date.now()-checked<(latest?.cyclone?.state==='unavailable'?12000:28000))return;
  updating=true;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7500);
  try{
   const response=await fetch(ENDPOINT+'?t='+Date.now(),{cache:'no-store',signal:controller.signal});
   if(!response.ok)throw new Error('PAGASA API HTTP '+response.status);
   const data=await response.json();if(!data||!data.ok)throw new Error('PAGASA source unavailable');
   latest=data;checked=Date.now();
  }catch(error){
   checked=Date.now();
   // Preserve a previously confirmed active cyclone, but show loss of verification.
   if(latest?.cyclone?.active===true){
    latest={...latest,cyclone:{...latest.cyclone,state:'stale'},checked_at:latest.checked_at};
   }else{
    latest={ok:false,checked_at:null,cyclone:{state:'unavailable',active:null},threat:{state:'unavailable'},flood:{state:'unavailable'}};
   }
  }finally{
   clearTimeout(timer);updating=false;render();
  }
 }
 const onChange=new MutationObserver(()=>render());
 onChange.observe(hero,{childList:true});
 onChange.observe(grid,{childList:true});
 onChange.observe(risks,{childList:true});
 document.getElementById('refreshWeather')?.addEventListener('click',()=>refresh(true));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh(true)});
 window.addEventListener('focus',()=>refresh(true));
 window.addEventListener('online',()=>refresh(true));
 ensure();render();refresh(true);
 setInterval(()=>refresh(false),20000);
})();
