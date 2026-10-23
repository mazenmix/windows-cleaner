/** Fresh retail LPG quotes when published, plus dated per-brand source fallbacks. */
const BRANDS=['Regasco','Solane','Petron Gasul','SL Gas','Phoenix LPG','Total Gas'];
const REGASCO='https://www.regascoexpress.com/Product/GetProductsBySubCategory?categoryName=11+Kg+Regasco';
const SOLANE='https://order.solane.com.ph/landing';
const isPrice=v=>Number.isFinite(v)&&v>=500&&v<=3000;
const textOnly=html=>String(html||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
 .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')
 .replace(/&nbsp;|&#160;/gi,' ').replace(/\s+/g,' ').trim();
function extractPrice(html,name){
 const text=textOnly(html);
 const title=name==='Regasco'?/11\s*kg\s*regasco\s*-\s*refill/i:/11\s*kg\s*AS\s*refill/i;
 const found=title.exec(text);
 if(!found)return null;
 const near=text.slice(found.index+found[0].length,found.index+found[0].length+90);
 const numbers=[...near.matchAll(/(?:PHP\s*|₱\s*)?((?:[1-9]\d?,\d{3}|\d{3,4})(?:\.\d{1,2})?)/gi)]
 .map(m=>Number(m[1].replace(/,/g,''))).filter(isPrice);
 return numbers[0]??null;
}
async function vendor(url,name){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
 try{
  const r=await fetch(url,{signal:controller.signal,headers:{accept:'text/html,application/json,*/*'},cf:{cacheTtl:0,cacheEverything:false}});
  if(!r.ok)throw Error('Vendor HTTP '+r.status);
  const price=extractPrice(await r.text(),name);
  if(!isPrice(price))throw Error('Invalid 11kg quote: '+name);
  return {name,price,source_url:url};
 }finally{clearTimeout(timeout)}
}
const respond=body=>new Response(JSON.stringify(body),{headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'private, no-store','x-content-type-options':'nosniff'
}});
export async function onRequestGet(context){
 const u=new URL(context.request.url),cache=caches.default;
 const key=new Request(u.origin+'/api/lpg-live-snapshot-v1');
 if(u.searchParams.get('force')!=='1'){
  const old=await cache.match(key);
  if(old)return respond(await old.json());
 }
 let saved;
 try{
  const result=await fetch(u.origin+'/data/gaswatch-lpg.json?ts='+Date.now(),{
   headers:{'cache-control':'no-cache'},cf:{cacheTtl:0,cacheEverything:false}});
  if(!result.ok)throw Error('Snapshot HTTP '+result.status);
  saved=await result.json();
 }catch(e){return respond({ok:false,checked_at:new Date().toISOString(),brands:[],source_error:String(e)})}
 if(!saved||!Array.isArray(saved.lpg)||saved.lpg.length!==6)
  return respond({ok:false,brands:[],source_error:'Incomplete LPG source snapshot'});
 const now=Date.now(),at=new Date(now).toISOString();
 const byName=new Map(saved.lpg.map(x=>[x.name,x.price]));
 const verified=saved.verified||{},verifiedDates=saved.last_verified_at_by_brand||{};
 const brands=BRANDS.map(name=>{
  const date=verifiedDates[name]||(verified[name]?saved.checked_at:null);
  const stamp=Date.parse(date||''),within=Number.isFinite(stamp)&&now>=stamp&&now-stamp<72*3600000;
  const doe=String(verified[name]||'').includes('DOE');
  return {name,price:isPrice(Number(byName.get(name)))?Number(byName.get(name)):null,
   quality:verified[name]&&within?(doe?'doe-monitored':'official-snapshot'):'reference',
   verified_at:date||null,
   source_url:doe?saved.doe_document:(saved.official_sources?.[name]||saved.source_url),
   source_period:doe?saved.doe_document_label:null};
 });
 const settled=await Promise.allSettled([vendor(REGASCO,'Regasco'),vendor(SOLANE,'Solane')]);
 let sourceError=false;
 for(const outcome of settled){
  if(outcome.status==='fulfilled'){
   const entry=brands.find(x=>x.name===outcome.value.name);
   Object.assign(entry,{price:outcome.value.price,quality:'official-live',
    verified_at:at,source_url:outcome.value.source_url,source_period:null});
  }else sourceError=true;
 }
 const payload={ok:true,checked_at:at,tank_kg:11,source_error:sourceError,brands,
  verified_brand_count:brands.filter(x=>x.quality!=='reference').length,
  live_brand_count:brands.filter(x=>x.quality==='official-live').length};
 if(context.waitUntil)context.waitUntil(cache.put(key,new Response(JSON.stringify(payload),
  {headers:{'content-type':'application/json','cache-control':'public,max-age=0,s-maxage=60'}})));
 return respond(payload);
}
