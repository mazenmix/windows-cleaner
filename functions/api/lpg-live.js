/* Mirror the prices currently displayed by GasWatch PH, not DOE/vendor quotes. */
const NAMES=['Regasco','Solane','Petron Gasul','SL Gas','Phoenix LPG','Total Gas'];
function normalize(doc){
 if(!doc||doc.provider!=='GasWatch PH'||doc.tank_kg!==11||!Array.isArray(doc.brands))return null;
 const byName=new Map(doc.brands.map(row=>[row.name,Number(row.price)]));
 if(byName.size!==6||NAMES.some(name=>!byName.has(name)||!Number.isFinite(byName.get(name))||byName.get(name)<500||byName.get(name)>3000))return null;
 return {ok:true,provider:'GasWatch PH',source_url:'https://gaswatchph.com/',
  tank_kg:11,source_updated_at:doc.updated_at,prices_are_estimates:true,
  brands:NAMES.map(name=>({name,price:byName.get(name)}))};
}
export async function onRequestGet({request}){
 const response=await fetch(new URL('/data/gaswatch-mirror-lpg.json?ts='+Date.now(),request.url),{
  headers:{'cache-control':'no-cache'},cf:{cacheTtl:0,cacheEverything:false}});
 if(!response.ok)return new Response(JSON.stringify({ok:false,error:'Mirror source unavailable'}),{
  status:503,headers:{'content-type':'application/json','cache-control':'no-store'}});
 const payload=normalize(await response.json());
 if(!payload)return new Response(JSON.stringify({ok:false,error:'Incomplete GasWatch prices'}),{
  status:503,headers:{'content-type':'application/json','cache-control':'no-store'}});
 return new Response(JSON.stringify(payload),{headers:{'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store','x-content-type-options':'nosniff'}});
}
