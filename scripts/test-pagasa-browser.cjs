'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
let version='active';
function payload(){
 const cyclone=version==='active'?{
  state:'active',active:true,name:'ROSAL',category:'Typhoon',bulletin_no:10,
  center:'350 km East of Itbayat, Batanes',movement:'Moving Northwestward at 15 km/h',
  wind_kmh:165,gust_kmh:205,issued_at:'2026-10-22T09:00:00.000Z'
 }:version==='clear'?{state:'clear',active:false}:{state:'unavailable',active:null};
 return {ok:true,cyclone,checked_at:new Date().toISOString(),
  threat:{state:'available',period:'October 15, 2026 - October 28, 2026'},
  flood:{state:'unverified',active_count:null,summary:'Confirm official river-basin guidance.'}};
}
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [390,1280]){
   const context=await browser.newContext({viewport:{width,height:840}});
   await context.route('**/api/pagasa-live*',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload())}));
   await context.route('**/api/weather?*',r=>r.fulfill({status:503,contentType:'application/json',body:'{"ok":false}'}));
   const page=await context.newPage();
   const error=[];page.on('pageerror',e=>error.push(e.message));
   await page.goto('http://127.0.0.1:8765/weather-now.html',{waitUntil:'domcontentloaded',timeout:25000});
   await page.waitForTimeout(1200);
   await page.evaluate(()=>{
    const hero=document.getElementById('weatherHero');
    hero.innerHTML='<div class="hero-grid"><div class="weather-main-pane"></div><div class="control-card"><div class="control-title">SELECT ANY PHILIPPINE AREA</div><select class="select"><option>Metro Manila</option></select><div class="search-wrap"><input class="search-input"></div><div class="control-actions"><button class="action">Load Region</button></div></div></div>';
    const grid=document.getElementById('alertGrid');
    grid.innerHTML=Array.from({length:3},()=>'<article class="alert-card"><div class="alert-top"><div class="alert-title">PAGASA</div><span class="tag">OFFICIAL</span></div><div class="alert-big">Unverified</div><div class="alert-copy">Waiting</div></article>').join('');
    document.getElementById('riskGrid').innerHTML='<div class="risk"><div class="k">Typhoon / PAR</div><div class="v">CHECK</div><div class="sub">Starting</div></div>';
   });
   await page.waitForFunction(()=>document.querySelector('#mxTyphoonAlertTitle')?.textContent?.includes('ROSAL'),{timeout:15000});
   const controls=await page.locator('#weatherHero .mx-tc-control-row > *').count();
   assert.equal(controls,2,'Control and typhoon card must be parallel siblings');
   assert.equal(await page.locator('#alertGrid .mx-tc-red').count(),3,'All PAGASA cards must receive red cyclone styling');
   assert.match(await page.locator('#mxTyphoonAlertSummary').innerText(),/165 km\/h/);
   version='clear';await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
   await page.waitForFunction(()=>document.querySelector('#mxTyphoonAlertTitle')?.textContent==='No Typhoon for now',{timeout:15000});
   assert.equal(await page.locator('#weatherHero .mx-tc-verified-clear').count(),1,'Confirmed PAGASA clear should show the soft green card');
   assert.equal(await page.locator('#weatherHero .mx-tc-live-pill').count(),1,'Confirmed PAGASA clear should have a Live badge and pulse');
   assert.equal(await page.locator('#weatherHero .mx-tc-live-dot').count(),1,'Live badge must have a green dot');
   assert.equal(await page.locator('#weatherHero .mx-tc-alert-meta').getByText('Verification pending').count(),0,'No pending-verification copy on verified-clear card');
   assert.equal(await page.locator('#alertGrid .mx-tc-red').count(),0,'Red should clear when the official bulletin confirms clear');
   version='unavailable';await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
   await page.waitForFunction(()=>document.querySelector('#mxTyphoonAlertTitle')?.textContent?.includes('unavailable'),{timeout:15000});
   assert.equal(await page.locator('#alertGrid .mx-tc-red').count(),0,'Unknown must not fabricate an active cyclone');
   assert.match(await page.locator('#mxTyphoonAlertSummary').innerText(),/could not be verified/i,'Unknown must not be painted green');
   assert.equal(await page.locator('#weatherHero .mx-tc-verified-clear').count(),0,'Unverified source must never look clear');
   assert.equal(await page.locator('#weatherHero .mx-tc-live-pill').count(),0,'Unverified source must never claim Live');
   assert.deepEqual(error,[],'Client JavaScript errors: '+error.join(' | '));
   console.log('PASS responsive PAGASA alert',width,'active / clear / unavailable.');
   version='active';
   await context.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
