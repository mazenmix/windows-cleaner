'use strict';
/* Mirrors the six *displayed*, estimated 11kg GasWatch PH LPG prices.
   Never substitutes unrelated DOE/vendor quotes; partial scrapes are rejected. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const FILE='data/gaswatch-mirror-lpg.json';
const names=['Regasco','Solane','Petron Gasul','SL Gas','Phoenix LPG','Total Gas'];
const source='https://gaswatchph.com/';
function parsePrices(rows){
 const normalized=new Map();
 for(const row of rows){
  const match=names.find(name=>name.toLowerCase()===String(row.name||'').trim().toLowerCase());
  const val=Number(String(row.price||'').replace(/,/g,''));
  if(match&&Number.isFinite(val)&&val>=500&&val<=3000&&!normalized.has(match))normalized.set(match,val);
 }
 assert.equal(normalized.size,6,'GasWatch incomplete: refusing to replace saved prices');
 return names.map(name=>({name,price:normalized.get(name)}));
}
async function scrape(page){
 await page.goto(source,{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>{
  const el=[...document.querySelectorAll('h1,h2,h3')].find(x=>/Gasul\s*\/\s*LPG Prices/i.test(x.textContent||''));
  return !!el;
 },{timeout:25000});
 const tab=page.locator('button').filter({hasText:/^11\s*kg$/i}).first();
 if(await tab.count())await tab.click({timeout:8000}).catch(()=>{});
 const attempt=async()=>page.evaluate((brandNames)=>{
  const root=[...document.querySelectorAll('section')].find(x=>/Gasul\s*\/\s*LPG Prices/i.test(x.querySelector('h1,h2,h3')?.textContent||''))
   ||document.querySelector('#lpg')||document.body;
  const cells=[...root.querySelectorAll('.lpg-card,[class*="lpg-card"]')];
  // The site presents LPG prices as separate cards; never guess from other page text.
  const clean=x=>String(x||'').replace(/\s+/g,' ').trim();
  const candidates=cells.length>=6?cells:[...root.querySelectorAll('.lpg-grid > *,[class*="lpg-grid"] > *')];
  const output=[];
  for(const card of candidates){
   const heading=clean(card.querySelector('.lpg-name,[class*="lpg-name"]')?.textContent||card.querySelector('h3,h4,strong')?.textContent);
   const name=brandNames.find(n=>heading.toLowerCase()===n.toLowerCase()||heading.toLowerCase().startsWith(n.toLowerCase()+' '));
   if(!name||output.some(x=>x.name===name))continue;
   const priceText=clean(card.querySelector('.lpg-price,[class*="lpg-price"]')?.textContent||card.textContent);
   const match=priceText.match(/(?:PHP\s*|₱\s*)(\d{1,2}(?:,\d{3})?|\d{3,4})(?:\.\d{2})?/i);
   if(match)output.push({name,price:match[1].replace(/,/g,'')});
  }
  return output;
 },names);
 for(let i=0;i<20;i++){
  const rows=await attempt();
  if(rows.length===6)return rows;
  await page.waitForTimeout(900);
 }
 const debug=await page.evaluate(()=>{
  const heading=[...document.querySelectorAll('h1,h2,h3,h4')].find(e=>/Gasul\s*\/\s*LPG/i.test(e.textContent||''));
  const section=heading?.closest('section')||document.querySelector('#lpg');
  return {title:document.title,url:location.href,
    candidateCards:document.querySelectorAll('.lpg-card,[class*="lpg-card"]').length,
    around:(document.body.innerText||'').slice(Math.max(0,(document.body.innerText||'').indexOf('Gasul / LPG')-200), (document.body.innerText||'').indexOf('Gasul / LPG')+1500),
    sectionHTML:section?.outerHTML?.slice(0,9500)};
 });
 console.log('GASWATCH_DIAGNOSTIC',JSON.stringify(debug));
 throw Error('GasWatch six 11kg price cards not found; keeping previous mirror unchanged');
}
async function main(){
 // Deterministic fixture check catches parser regressions independently from network.
 assert.deepEqual(parsePrices(names.map((name,i)=>({name,price:[1229,1266,1291,1319,1334,1636][i]})))[0],
  {name:'Regasco',price:1229});
 assert.throws(()=>parsePrices([{name:'Regasco',price:1229}]),/incomplete/);
 const browser=await chromium.launch({headless:true,...(process.env.GASWATCH_CHROME?{executablePath:process.env.GASWATCH_CHROME}:{}),args:['--no-sandbox']});
 let rows;
 try{
  const page=await browser.newPage({viewport:{width:1280,height:960}});
  rows=parsePrices(await scrape(page));
 }finally{await browser.close()}
 const previous=JSON.parse(fs.readFileSync(FILE,'utf8'));
 const prior=JSON.stringify(previous.brands.map(x=>({name:x.name,price:x.price})));
 if(prior===JSON.stringify(rows)){
  console.log('UNCHANGED: all six GasWatch 11kg cards still match',JSON.stringify(rows));
  return;
 }
 const next={provider:'GasWatch PH',source_url:source,tank_kg:11,
  prices_are_estimates:true,updated_at:new Date().toISOString(),brands:rows};
 fs.writeFileSync(FILE,JSON.stringify(next,null,2)+'\n');
 console.log('CHANGED: mirrored six 11kg displayed prices',JSON.stringify(rows));
}
main().catch(e=>{console.error('GasWatch sync did not publish unverified prices:',e);process.exitCode=1});
