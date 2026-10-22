'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
let current='active';
function status(){
 const cyclone=current==='active'?{state:'active',active:true,category:'Typhoon',name:'ROSAL',bulletin_no:10,issued_at:'2026-10-22T09:00:00.000Z'}:
  current==='clear'?{state:'clear',active:false}:current==='stale'?{state:'stale',active:true,category:'Typhoon',name:'ROSAL'}:
  {state:'unavailable',active:null};
 return {ok:true,checked_at:'2026-10-22T09:52:00.000Z',cyclone,threat:{state:'available'},flood:{state:'unverified'}};
}
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [390,1280]){
   const context=await browser.newContext({viewport:{width,height:840}});
   await context.route('**/api/pagasa-live*',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(status())}));
   await context.route('**/api/weather?*',r=>r.fulfill({status:503,contentType:'application/json',body:'{"ok":false}'}));
   for(const path of ['/','/weather-now.html','/news.html','/daily-cost-watch.html']){
    current='active';
    const page=await context.newPage();
    await page.goto('http://127.0.0.1:8765'+path,{waitUntil:'domcontentloaded',timeout:25000});
    if(path==='/weather-now.html'){
      assert.equal(await page.locator('.mx-global-typhoon-alert').count(),0,
        'Weather already has large typhoon card and must not duplicate the small header badge');
      await page.waitForSelector('#mxTyphoonAlertCard',{timeout:15000});
      const card=page.locator('#mxTyphoonAlertCard');
      const size=await card.locator('.mx-tc-symbol').evaluate(el=>el.getBoundingClientRect().width);
      assert.ok(size>=50,'Keep premium large storm triangle on Weather page');
      assert.equal(await card.locator('.mx-tc-source').evaluateAll(nodes=>nodes.filter(n=>getComputedStyle(n).display!=='none').length),0,
        'Source label must not be visible');
      console.log('PASS',width,path,'no duplicate header badge and prominent typhoon card');
      await page.close();
      continue;
    }
    await page.waitForSelector('.mx-global-typhoon-alert:not([hidden])',{timeout:15000});
    const badge=page.locator('.mx-global-typhoon-alert');
    assert.match(await badge.innerText(),/ROSAL/i,'Missing verified cyclone name '+path);
    assert.equal(await page.locator('.mx-global-storm-icon').count(),1,'Missing cyclone icon '+path);
    if(path==='/'){
      assert.equal(await page.locator('#foodPricesSection .food-prices-head > #mxHomepageTyphoonSlot > .mx-global-typhoon-alert').count(),1,
        'Homepage badge must be centered over Food Prices Today');
      assert.equal(await page.locator('.header .navbar > .brand .mx-global-typhoon-alert').count(),0,
        'Homepage badge must not remain beside logo');
      const center=await page.evaluate(()=>{
        const a=document.querySelector('#mxHomepageTyphoonSlot').getBoundingClientRect();
        const b=document.querySelector('#foodPricesSection .food-prices-head').getBoundingClientRect();
        return {delta:Math.abs(a.left+a.width/2-(b.left+b.width/2)),width:b.width};
      });
      assert.ok(center.delta<12,'Homepage badge not horizontally centered: '+JSON.stringify(center));
    }else if(path==='/daily-cost-watch.html'){
      assert.equal(await page.locator('.hero .hero-inner > #mxDailyTyphoonSlot > .mx-global-typhoon-alert').count(),1,
        'Daily Cost alert not positioned at the center of its hero header');
      assert.equal(await page.locator('.header .navbar > .brand .mx-global-typhoon-alert').count(),0,
        'Daily Cost alert must not remain near the logo');
      const center=await page.evaluate(()=>{
        const a=document.getElementById('mxDailyTyphoonSlot').getBoundingClientRect();
        const b=document.querySelector('.hero .hero-inner').getBoundingClientRect();
        return {delta:Math.abs(a.left+a.width/2-b.left-b.width/2),width:b.width};
      });
      assert.ok(center.delta<12,'Daily Cost alert must be centered: '+JSON.stringify(center));
    }else{
      assert.equal(await page.locator('.header .navbar > .brand .mx-global-typhoon-alert, .topbar .nav > .mx-global-typhoon-alert').count(),1,
        'Badge not beside brand '+path);
    }
    const visible=await badge.evaluate(el=>{
      const b=el.getBoundingClientRect(),css=getComputedStyle(el);
      return {width:b.width,height:b.height,right:b.right,display:css.display};
    });
    assert.ok(visible.width>75&&visible.height>25,'Badge too small / invisible: '+JSON.stringify(visible));

    current='clear';
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await page.waitForFunction(()=>document.querySelector('.mx-global-typhoon-alert')?.hidden===true,{timeout:10000});
    current='active';await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await page.waitForSelector('.mx-global-typhoon-alert:not([hidden])',{timeout:10000});
    current='stale';await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await page.waitForFunction(()=>document.querySelector('.mx-global-typhoon-alert')?.hidden===true,{timeout:10000});
    console.log('PASS',width,path,'verified ROSAL, clear, stale, compact icon and weather source removal');
    await page.close();
   }
   await context.close();
  }
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1});
