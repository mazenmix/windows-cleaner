'use strict';
const fs=require('node:fs');
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const snapshot=JSON.parse(fs.readFileSync('data/gaswatch-lpg.json','utf8'));
const count=Object.keys(snapshot.verified||{}).length;
assert.equal(snapshot.lpg.length,6);
assert.equal(snapshot.verified_brand_count,count);
assert.equal(snapshot.carried_forward_brands.length,6-count);
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [390,1280]){
   const context=await browser.newContext({viewport:{width,height:850}});
   await context.route('**/data/gaswatch-lpg.json*',route=>route.fulfill({
     status:200,contentType:'application/json',body:JSON.stringify(snapshot)
   }));
   let revision=0;
   await context.route('**/api/lpg-live?*',route=>{
     const altered=structuredClone(snapshot.lpg);
     const petron=altered.find(x=>x.name==='Petron Gasul');
     petron.price=revision===0?1430:1477;
     return route.fulfill({status:200,contentType:'application/json',
       body:JSON.stringify({ok:true,tank_kg:11,checked_at:new Date().toISOString(),
         brands:altered.map(x=>({...x,quality:'official-snapshot'}))})});
   });
   const page=await context.newPage();
   await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.getElementById('mxLpgStatus')?.textContent?.includes('/6 source-verified'),null,{timeout:14000});
   const box=page.locator('#lpgGrid .lpg-card').filter({has:page.locator('.lpg-name',{hasText:'Petron Gasul'})});
   await box.first().locator('.lpg-price').waitFor();
   await page.waitForFunction(()=>{
     const card=[...document.querySelectorAll('#lpgGrid .lpg-card')].find(c=>c.querySelector('.lpg-name')?.textContent.includes('Petron Gasul'));
     return card?.querySelector('.lpg-price')?.textContent.replace(/[^0-9]/g,'')==='1430';
   },null,{timeout:14000});
   revision=1;
   // The header refresh button is intentionally hidden at phone widths.
   await page.evaluate(()=>document.getElementById('refreshAll')?.click());
   await page.waitForFunction(()=>{
     const card=[...document.querySelectorAll('#lpgGrid .lpg-card')].find(c=>c.querySelector('.lpg-name')?.textContent.includes('Petron Gasul'));
     return card?.querySelector('.lpg-price')?.textContent.replace(/[^0-9]/g,'')==='1477';
   },null,{timeout:14000});
   const badge=await page.locator('#mxLpgStatus').innerText();
   assert.ok(badge.includes(count+'/6 source-verified'),badge);
   const html=await page.locator('body').innerText();
   for(const phrase of [
    'Official DA food and agricultural commodity prices, grouped so everything is visible at a glance.',
    'PHP rates per 1 unit of foreign currency',
    'Latest fuel prices from major brands nationwide.',
    'Compare cooking gas prices across major brands.',
    'PHILIPPINES FOOD PRICE MONITOR'
   ])assert.ok(!html.includes(phrase),'Old UI copy remains: '+phrase);
   console.log('PASS',width,'LPG source freshness badge',badge,'all requested descriptions removed');
   await context.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
