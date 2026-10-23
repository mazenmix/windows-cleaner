'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const mirror=JSON.parse(fs.readFileSync('data/gaswatch-mirror-lpg.json','utf8'));
const brands=['Regasco','Solane','Petron Gasul','SL Gas','Phoenix LPG','Total Gas'];
const html=fs.readFileSync('index.html','utf8');
assert.ok(html.includes('/assets/lpg-gaswatch-sync.js'),'GasWatch updater must update LPG cards');
assert.ok(!html.includes('src="/assets/lpg-live-sync.js'),'Old updater must not compete');
assert.ok(!html.includes('src="/assets/lpg-source-status.js'),'Source badge updater must not compete');
assert.deepEqual(mirror.brands.map(x=>x.name),brands);
assert.deepEqual(mirror.brands.map(x=>x.price),[1229,1266,1291,1319,1334,1636]);
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.GASWATCH_CHROME?{executablePath:process.env.GASWATCH_CHROME}:{})});
 try{
  for(const width of [390,1280]){
   const ctx=await browser.newContext({viewport:{width,height:850}});
   let revision=0;
   await ctx.route('**/api/lpg-live?*',route=>{
    const rows=structuredClone(mirror.brands);
    if(revision){rows[0].price=1600;rows[2].price=1477}
    return route.fulfill({status:200,contentType:'application/json',
     body:JSON.stringify({ok:true,tank_kg:11,brands:rows})});
   });
   const page=await ctx.newPage();
   await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded',timeout:25000});
   await page.waitForFunction(()=>{
    const cards=[...document.querySelectorAll('#lpgGrid .lpg-card')];
    const row=cards.find(x=>x.querySelector('.lpg-name')?.textContent?.includes('Regasco'));
    return row?.querySelector('.lpg-price')?.textContent.replace(/[^0-9]/g,'')==='1229';
   },null,{timeout:15000});
   const prices=await page.locator('#lpgGrid .lpg-card').evaluateAll(cards=>cards.map(c=>({
     name:c.querySelector('.lpg-name')?.textContent?.trim(),
     price:Number(c.querySelector('.lpg-price')?.textContent?.replace(/[^0-9]/g,'')),
     cheapest:c.classList.contains('cheapest')})));
   for(const row of mirror.brands){
    assert.equal(prices.find(p=>p.name===row.name)?.price,row.price,'Initial GasWatch card '+row.name);
   }
   assert.equal(prices.find(p=>p.name==='Regasco').cheapest,true,'Regasco cheapest initially');
   assert.equal(await page.locator('#mxLpgStatus').count(),0,'No checked/source badge');
   assert.equal(await page.locator('#lpgGrid .mx-lpg-freshness').count(),0,'No reference/official badges');
   revision=1;
   await page.evaluate(()=>document.getElementById('refreshAll')?.click());
   await page.waitForFunction(()=>{
    const cards=[...document.querySelectorAll('#lpgGrid .lpg-card')];
    const val=name=>Number(cards.find(c=>c.querySelector('.lpg-name')?.textContent?.trim()===name)
       ?.querySelector('.lpg-price')?.textContent?.replace(/[^0-9]/g,''));
    return val('Regasco')===1600&&val('Petron Gasul')===1477;
   },null,{timeout:14000});
   const cheap=await page.locator('#lpgGrid .lpg-card.cheapest .lpg-name').allInnerTexts();
   assert.deepEqual(cheap,['Solane'],'Lowest-price highlight must change with updated cards');
   console.log('PASS',width,'all six GasWatch price cards; refresh updates actual numbers; no badges');
   await ctx.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
