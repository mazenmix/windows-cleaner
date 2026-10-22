'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [390,1280]){
   const context=await browser.newContext({viewport:{width,height:840}});
   let newsStatus=200;
   const fresh=new Date(Date.now()-18*60*1000).toISOString();
   const old=new Date(Date.now()-3*24*3600000).toISOString();
   const stories=[
    {source:'GMA',headline:'PAGASA updates tropical storm conditions and rainfall across the Philippines',published_at:fresh,url:'https://www.gmanetwork.com/news/weather/latest'},
    {source:'GMA',headline:'PAGASA weather report from three days ago should never appear',published_at:old,url:'https://www.gmanetwork.com/news/weather/old'}
   ];
   await context.route('**/api/weather-news*',r=>r.fulfill({
    status:newsStatus,contentType:'application/json',
    body:newsStatus===200?JSON.stringify({ok:true,live:true,stale:false,items:stories,checked_at:new Date().toISOString()}):'{"ok":false,"items":[]}'
   }));
   await context.route('**/api/pagasa-live*',r=>r.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({ok:true,checked_at:new Date().toISOString(),cyclone:{state:'active',active:true,category:'Typhoon',name:'ROSAL',bulletin_no:11},threat:{state:'available'},flood:{state:'clear'}})
   }));
   await context.route('**/api/weather?*',r=>r.fulfill({status:503,contentType:'application/json',body:'{"ok":false}'}));
   for(const path of ['/','/weather-now.html','/news.html','/daily-cost-watch.html']){
    const page=await context.newPage();
    await page.goto('http://127.0.0.1:8765'+path,{waitUntil:'domcontentloaded',timeout:20000});
    if(path==='/weather-now.html'){
      assert.equal(await page.locator('.mx-global-typhoon-alert').count(),0,'Weather must omit small header alert');
    }else{
    await page.waitForSelector('.mx-global-typhoon-alert:not([hidden])',{timeout:15000});
    }
    await page.waitForTimeout(200);
    if(path!=='/weather-now.html'){
    const sizes=await page.evaluate(()=>{
      const a=document.querySelector('.mx-global-typhoon-alert').getBoundingClientRect(),
      b=document.querySelector('.visitor-chip.today').getBoundingClientRect();
      return {a:a.width,b:b.width,ah:a.height,bh:b.height};
    });
    assert.ok(sizes.b>=72,'Visitors Today baseline missing');
    if(path==='/'||path==='/daily-cost-watch.html'){
      assert.ok(sizes.a>=200&&sizes.ah>=52,
        'Centered premium typhoon alert must have space for readable full storm name: '+JSON.stringify(sizes));
    }else{
      assert.ok(Math.abs(sizes.a-sizes.b)<3,
        'Header badge should remain compact on newsroom: '+JSON.stringify(sizes));
    }
    }
    if(path==='/weather-now.html'){
      assert.match(await page.locator('.nav-actions a').allTextContents().then(a=>a.join(' ')),/Money Converter/);
      assert.equal(await page.locator('.nav-actions a:has-text("Money Converter")').getAttribute('href'),'https://mxmoney.pages.dev/');
      await page.waitForFunction(()=>document.querySelector('#weatherNewsTrack')?.textContent?.includes('PAGASA updates tropical storm conditions'),{timeout:15000});
      const text=await page.locator('#weatherNewsTrack').innerText();
      assert.ok(!text.includes('three days ago'),'Old RSS article reached live marquee');
      assert.equal(await page.locator('#weatherNewsTrack time').first().getAttribute('datetime'),fresh);
      newsStatus=503;
      await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
      await page.waitForFunction(()=>document.querySelector('#weatherNewsTrack')?.textContent?.includes('temporarily unavailable'),{timeout:10000});
      assert.ok(!await page.locator('#weatherNewsTrack').innerText().then(x=>x.includes('PAGASA updates tropical storm conditions')),
        'A failing feed must not keep displaying old headline as fresh');
      const ticker=await page.locator('#weatherNewsTrack').evaluate(el=>({
        animation:getComputedStyle(el).animationName,
        duration:parseFloat(getComputedStyle(el).animationDuration),
        children:el.children.length,
        scrollWidth:el.scrollWidth,
        viewportWidth:el.parentElement.clientWidth
      }));
      assert.equal(ticker.animation,'weatherNewsMarquee','Weather ticker must keep moving when RSS is unavailable');
      assert.ok(ticker.duration>0&&ticker.children>=4,'Weather fallback must scroll repeated source-status messages');
    }
    console.log('PASS live alert, navigation and fresh-news checks',width,path);
    await page.close();
   }
   await context.close();
  }
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
