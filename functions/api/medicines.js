const SOURCE="https://eamc.doh.gov.ph/drugs-and-medicines-price-list/";
const TTL=60;
const LAST_GOOD_TTL=2592000;

function decode(s){
 return String(s||"")
  .replace(/<br\s*\/?>/gi," ")
  .replace(/&nbsp;|&#160;/gi," ")
  .replace(/&amp;/gi,"&").replace(/&quot;|&#34;/gi,'"')
  .replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">")
  .replace(/&#8369;|&peso;/gi,"₱")
  .replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
}
function num(s){
 const n=Number(String(s||"").replace(/[^0-9.]/g,""));
 return Number.isFinite(n)?n:null;
}
async function getHtml(){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);
 try{
  const r=await fetch(SOURCE+"?mx_fresh="+Date.now(),{headers:{
   "user-agent":"Mozilla/5.0 (compatible; MXMedicineWatch/3.0)",
   "accept":"text/html,*/*",
   "cache-control":"no-cache"
  },signal:ctrl.signal,cf:{cacheTtl:0,cacheEverything:false}});
  if(!r.ok)throw new Error("HTTP "+r.status);
  return await r.text();
 }finally{clearTimeout(timer)}
}
function parse(html){
 const rows=[];
 const trs=String(html||"").match(/<tr\b[\s\S]*?<\/tr>/gi)||[];
 for(const tr of trs){
   const cells=[...tr.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>decode(m[1]));
   if(cells.length<6)continue;
   if(/^NO\.?$/i.test(cells[0])||/ITEM CODE/i.test(cells[1])||/DESCRIPTION/i.test(cells[2]))continue;

   const no=parseInt(cells[0].replace(/\D/g,""),10);
   const code=cells[1];
   const description=cells[2];
   const unit=cells[3];
   const category=cells[4];
   const price=num(cells[5]);

   if(!description||!price||price<=0||price>100000)continue;
   rows.push({no:Number.isFinite(no)?no:null,code,description,unit,category,price});
 }
 return rows;
}
const COMMON=[
 "PARACETAMOL","IBUPROFEN","MEFENAMIC","AMOXICILLIN","CO-AMOXICLAV","AMOXICILLIN + CLAVULANIC",
 "AZITHROMYCIN","CETIRIZINE","LORATADINE","OMEPRAZOLE","LOSARTAN","AMLODIPINE","METFORMIN",
 "ATORVASTATIN","SIMVASTATIN","SALBUTAMOL","AMBROXOL","CIPROFLOXACIN","DOXYCYCLINE",
 "METRONIDAZOLE","LOPERAMIDE","ORAL REHYDRATION","ASPIRIN","CLOPIDOGREL","FUROSEMIDE",
 "CARVEDILOL","PREDNISONE","PREDNISOLONE","VITAMIN B COMPLEX","ASCORBIC ACID"
];
function rank(items){
 const score=x=>{
  const d=x.description.toUpperCase();
  let s=999;
  COMMON.forEach((k,i)=>{if(d.includes(k)&&i<s)s=i});
  return s;
 };
 return items.slice().sort((a,b)=>{
   const sa=score(a),sb=score(b);
   if(sa!==sb)return sa-sb;
   if(sa<999)return a.price-b.price;
   return (a.no||99999)-(b.no||99999);
 });
}
function response(data,status=200){
 return new Response(JSON.stringify(data),{status,headers:{
  "content-type":"application/json; charset=utf-8",
  "cache-control":"public, max-age="+TTL+", s-maxage="+TTL,
  "access-control-allow-origin":"*"
 }});
}
export async function onRequestGet(context){
 const cache=caches.default;
 const u=new URL(context.request.url);
 const freshKey=new Request(u.origin+"/api/medicines-cache-v3");
 const lkgKey=new Request(u.origin+"/api/medicines-last-good-v1");
 const force=u.searchParams.get("force")==="1";
 if(!force){
   const hit=await cache.match(freshKey);
   if(hit)return hit;
 }
 try{
   const html=await getHtml();
   const items=parse(html);
   if(items.length<100)throw new Error("Medicine table parse returned only "+items.length+" rows");
   const m=html.match(/Updated\s+as\s+of\s+([^<\n]+)/i);
   const updated=m?decode(m[1]).replace(/\s{2,}.*/,"").trim():"Latest published list";
   const data={
     ok:true,live:true,fallback:false,stale:false,
     source:"DOH • East Avenue Medical Center",source_url:SOURCE,
     updated,checked_at:new Date().toISOString(),count:items.length,items:rank(items)
   };
   const fresh=response(data);
   const keep=new Response(JSON.stringify(data),{status:200,headers:{
    "content-type":"application/json; charset=utf-8",
    "cache-control":"public, max-age="+LAST_GOOD_TTL+", s-maxage="+LAST_GOOD_TTL,
    "access-control-allow-origin":"*"
   }});
   context.waitUntil(Promise.all([cache.put(freshKey,fresh.clone()),cache.put(lkgKey,keep.clone())]));
   return fresh;
 }catch(e){
   const last=await cache.match(lkgKey);
   if(last){
    try{
     const j=await last.clone().json();
     if(j&&Array.isArray(j.items)&&j.items.length){
      return new Response(JSON.stringify({...j,ok:true,live:false,fallback:true,stale:true,checked_at:new Date().toISOString(),note:"EAMC source temporarily unavailable — last verified medicine list kept.",error:String(e)}),{status:200,headers:{
       "content-type":"application/json; charset=utf-8",
       "cache-control":"public, max-age=60, s-maxage=60",
       "access-control-allow-origin":"*"
      }});
     }
    }catch{}
   }
   return response({ok:false,live:false,fallback:false,stale:true,error:String(e),source:"DOH • East Avenue Medical Center",source_url:SOURCE,checked_at:new Date().toISOString()},502);
 }
}
