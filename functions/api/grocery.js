const TTL=21600;
const LANDING="https://www.dti.gov.ph/konsyumer/latest-srps-basic-necessities-prime-commodities";
const FALLBACK_PDF="https://www.dti.gov.ph/wp-content/uploads/2025/08/BNPCSRPBULLETIN01FEBRUARY2025.002.pdf";

function clean(s){
 return String(s||"")
  .replace(/\r/g,"")
  .replace(/&nbsp;|&#160;/gi," ")
  .replace(/&amp;/gi,"&")
  .replace(/\s+/g," ")
  .trim();
}
function decodeUrl(s){try{return decodeURIComponent(s)}catch(e){return s}}
function response(data,status=200){
 return new Response(JSON.stringify(data),{status,headers:{
  "content-type":"application/json; charset=utf-8",
  "cache-control":"public, max-age="+TTL+", s-maxage="+TTL,
  "access-control-allow-origin":"*"
 }});
}
async function fetchText(url,timeout=9000){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeout);
 try{
  const r=await fetch(url,{headers:{
   "user-agent":"Mozilla/5.0 (compatible; MXCostWatch/1.0)",
   "accept":"text/plain,text/html,application/xhtml+xml,*/*"
  },signal:ctrl.signal});
  if(!r.ok)throw new Error("HTTP "+r.status+" "+url);
  return await r.text();
 }finally{clearTimeout(timer)}
}
async function readable(url){
 try{return await fetchText(url)}
 catch(e){return await fetchText("https://r.jina.ai/"+url,12000)}
}
function scorePdf(url){
 const s=String(url).toLowerCase(); let score=0;
 if(/srp|bnpc|bulletin/.test(s))score+=50;
 const years=[...s.matchAll(/20\d{2}/g)].map(m=>Number(m[0])); if(years.length)score+=Math.max(...years)-2000;
 const months=[...s.matchAll(/\/(0?[1-9]|1[0-2])\//g)].map(m=>Number(m[1])); if(months.length)score+=Math.max(...months)/20;
 return score;
}
function discoverPdf(text){
 const found=new Set();
 for(const m of String(text||"").matchAll(/https?:\/\/[^\s)"']+\.pdf(?:\?[^\s)"']*)?/gi))found.add(decodeUrl(m[0]));
 for(const m of String(text||"").matchAll(/\((https?:\/\/[^)]+\.pdf[^)]*)\)/gi))found.add(decodeUrl(m[1]));
 const arr=[...found].filter(u=>/dti\.gov\.ph|esigaw\.dti\.gov\.ph/i.test(u));
 arr.sort((a,b)=>scorePdf(b)-scorePdf(a));
 return arr[0]||FALLBACK_PDF;
}
function classify(name){
 const n=String(name||"").toLowerCase();
 if(/sardine/.test(n))return"Canned Sardines";
 if(/milk|condensada|condensed|evaporated/.test(n))return"Milk";
 if(/coffee/.test(n))return"Coffee";
 if(/bread|loaf/.test(n))return"Bread";
 if(/noodle/.test(n))return"Instant Noodles";
 if(/water/.test(n))return"Bottled Water";
 if(/salt/.test(n))return"Salt";
 if(/detergent|laundry|soap bar/.test(n))return"Laundry";
 if(/toilet soap|safeguard|green cross/.test(n))return"Personal Care";
 if(/candle/.test(n))return"Candles";
 if(/corned beef|meat loaf|canned meat/.test(n))return"Canned Meat";
 if(/vinegar|patis|fish sauce|soy sauce|toyo/.test(n))return"Condiments";
 if(/battery|eveready/.test(n))return"Batteries";
 if(/flour/.test(n))return"Flour";
 return"Basic & Prime Commodities";
}
function isUnit(s){
 const x=clean(s).toLowerCase();
 return /^\d+(?:\.\d+)?\s*(g|kg|mg|ml|l|liter|litre|pcs?|pieces?|pack|packs|sachets?|bottles?|cans?|aa|aaa|d|#\d+[x\d-]*)\b/.test(x) ||
        /^(aa|aaa|d|#\d+[x\d-]*|\d+\s*pcs?\.?(?:\/pack)?)$/i.test(x);
}
function priceOf(s){
 const x=clean(s).replace(/[₱PHP,]/gi,"").trim();
 if(!/^\d+(?:\.\d{1,2})?$/.test(x))return null;
 const n=Number(x); return Number.isFinite(n)&&n>0&&n<100000?n:null;
}
function validName(s){
 const n=clean(s);
 if(n.length<2||n.length>180)return false;
 if(/^(basic necessities|prime commodities|unit|srp|suggested retail prices?|notes?|page \d+)/i.test(n))return false;
 if(/^\d+(?:\.\d+)?$/.test(n))return false;
 return /[a-z]/i.test(n);
}
function parseMarkdown(md){
 const out=[],seen=new Set();
 const lines=String(md||"").split("\n");
 for(const line of lines){
  if(!line.includes("|"))continue;
  let cells=line.split("|").map(clean).filter(Boolean);
  if(cells.length<3)continue;
  if(cells.every(x=>/^:?-+:?$/.test(x)))continue;

  // DTI PDF extraction commonly yields 3, 6, 9... columns: product | unit | SRP.
  for(let i=0;i+2<cells.length;i+=3){
   const name=cells[i],unit=cells[i+1],price=priceOf(cells[i+2]);
   if(!validName(name)||!price||!isUnit(unit))continue;
   const key=(name+"|"+unit+"|"+price).toLowerCase();
   if(seen.has(key))continue; seen.add(key);
   out.push({name,unit,price,category:classify(name)});
  }
 }
 return out;
}
function parseLoose(md){
 const out=[],seen=new Set(),lines=String(md||"").split("\n").map(clean).filter(Boolean);
 for(let i=0;i<lines.length-2;i++){
  const name=lines[i],unit=lines[i+1],price=priceOf(lines[i+2]);
  if(!validName(name)||!isUnit(unit)||!price)continue;
  const key=(name+"|"+unit+"|"+price).toLowerCase();
  if(seen.has(key))continue;seen.add(key);
  out.push({name,unit,price,category:classify(name)});
 }
 return out;
}
function dateLabel(text){
 const m=String(text||"").match(/AS\s+OF\s+([0-9]{1,2}\s+[A-Z]+\s+20\d{2})/i);
 return m?clean(m[1]):"Latest DTI SRP bulletin";
}
function rank(items){
 const preferred=["Sardines","Instant Noodles","Coffee","Milk","Bread","Bottled Water","Salt","Condiments","Canned Meat","Laundry","Personal Care","Candles"];
 const score=x=>{const i=preferred.indexOf(x.category);return i<0?999:i};
 return items.slice().sort((a,b)=>{
  const sa=score(a),sb=score(b);
  if(sa!==sb)return sa-sb;
  return a.name.localeCompare(b.name);
 });
}
export async function onRequestGet(context){
 const url=new URL(context.request.url),force=url.searchParams.get("force")==="1";
 const cache=caches.default;
 const key=new Request(url.origin+"/api/grocery-cache-v3");
 if(!force){
  const hit=await cache.match(key);
  if(hit)return hit;
 }
 try{
  let landing="";
  try{landing=await readable(LANDING)}catch(e){}
  const pdf=discoverPdf(landing);
  const md=await readable(pdf);
  let items=parseMarkdown(md);
  if(items.length<40)items=parseLoose(md);
  if(items.length<40)throw new Error("DTI SRP parser returned only "+items.length+" products");
  const out=response({
   ok:true,
   source:"Department of Trade and Industry • SRP Bulletin",
   source_url:pdf,
   landing_url:LANDING,
   updated:dateLabel(md),
   checked_at:new Date().toISOString(),
   count:items.length,
   items:rank(items)
  });
  context.waitUntil(cache.put(key,out.clone()));
  return out;
 }catch(e){
  return response({
   ok:false,error:String(e),
   source:"Department of Trade and Industry • SRP Bulletin",
   source_url:LANDING,
   checked_at:new Date().toISOString()
  },502);
 }
}
