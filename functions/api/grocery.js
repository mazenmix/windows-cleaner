const TTL=3600;
const LAST_GOOD_TTL=2592000;
const LANDING="https://www.dti.gov.ph/konsyumer/latest-srps-basic-necessities-prime-commodities";

const VERIFIED_FALLBACK=[
 {name:"Family's Budget Pack Plain Sardines",unit:"130g",price:15.25,category:"Canned Sardines"},
 {name:"Saba Philippine Sardines - NCR",unit:"155g",price:17.25,category:"Canned Sardines"},
 {name:"Saba Philippine Sardines - Luzon/Viz/Min",unit:"155g",price:17.50,category:"Canned Sardines"},
 {name:"Atami Regular Lid Sardines",unit:"155g",price:20.50,category:"Canned Sardines"},
 {name:"Mikado Regular Lid Sardines",unit:"155g",price:20.50,category:"Canned Sardines"},
 {name:"King Cup Regular Lid Sardines",unit:"155g",price:18.00,category:"Canned Sardines"},
 {name:"Mariko Regular Lid Sardines",unit:"155g",price:19.75,category:"Canned Sardines"},
 {name:"Sallenas Regular Lid Sardines",unit:"155g",price:18.50,category:"Canned Sardines"},
 {name:"Atami EOC Sardines",unit:"155g",price:21.25,category:"Canned Sardines"},
 {name:"Mikado EOC Sardines",unit:"155g",price:21.25,category:"Canned Sardines"},
 {name:"555 Bonus Pack Sardines",unit:"155g",price:19.65,category:"Canned Sardines"},
 {name:"Lucky 7 Sardines",unit:"155g",price:19.65,category:"Canned Sardines"},
 {name:"Bear Brand Powdered Milk",unit:"135g",price:50.00,category:"Milk"},
 {name:"Birch Tree Full Cream Milk",unit:"150g",price:70.75,category:"Milk"},
 {name:"Alaska Fortified Powdered Milk Drink",unit:"165g",price:44.00,category:"Milk"},
 {name:"Jersey Fortified Instant Powdered Milk Drink",unit:"300g",price:96.25,category:"Milk"},
 {name:"Blend 45 Pure Soluble Coffee",unit:"25g",price:20.25,category:"Coffee"},
 {name:"Great Taste Premium Coffee",unit:"25g",price:21.60,category:"Coffee"},
 {name:"Great Taste Granules Coffee",unit:"25g",price:22.00,category:"Coffee"},
 {name:"Great Taste Premium Coffee",unit:"50g",price:42.20,category:"Coffee"},
 {name:"Great Taste Granules Coffee",unit:"50g",price:43.00,category:"Coffee"},
 {name:"Cafe Puro 3-in-1",unit:"17g",price:4.70,category:"Coffee"},
 {name:"Blend 45 3-in-1 Original",unit:"18g",price:4.50,category:"Coffee"},
 {name:"San Mig Coffee 3-in-1 Original",unit:"20g",price:7.00,category:"Coffee"},
 {name:"Nescafe Original",unit:"26g",price:7.75,category:"Coffee"},
 {name:"Kopiko Black",unit:"30g",price:8.50,category:"Coffee"},
 {name:"Great Taste Original Twin Pack",unit:"33g",price:8.25,category:"Coffee"},
 {name:"Pinoy Pandesal (10 pcs)",unit:"250g",price:27.25,category:"Bread"},
 {name:"Pinoy Tasty",unit:"450g",price:44.00,category:"Bread"},
 {name:"SM Bonus Purified Water",unit:"300mL",price:5.00,category:"Bottled Water"},
 {name:"Magnolia Pure Water",unit:"355mL",price:8.50,category:"Bottled Water"},
 {name:"Refresh Water",unit:"500mL",price:6.75,category:"Bottled Water"},
 {name:"Nature's Spring Water",unit:"500mL",price:10.50,category:"Bottled Water"},
 {name:"Wilkins Pure Water",unit:"500mL",price:11.00,category:"Bottled Water"},
 {name:"Nature's Spring Water",unit:"1L",price:16.50,category:"Bottled Water"},
 {name:"Wilkins Pure Water",unit:"1L",price:18.00,category:"Bottled Water"},
 {name:"Lasap Rock Salt",unit:"250g",price:7.50,category:"Salt"},
 {name:"Fidel Coarse Salt - Luzon",unit:"250g",price:11.00,category:"Salt"},
 {name:"Lasap Iodized Salt",unit:"100g",price:4.75,category:"Salt"},
 {name:"Lasap Iodized Salt",unit:"250g",price:9.75,category:"Salt"},
 {name:"Ho-Mi Instant Mami Chicken/Beef",unit:"55g",price:8.50,category:"Instant Noodles"},
 {name:"Lucky Me! Instant Mami Chicken/Beef",unit:"55g",price:8.75,category:"Instant Noodles"},
 {name:"Payless Instant Mami Chicken/Beef",unit:"55g",price:7.50,category:"Instant Noodles"},
 {name:"Quick Chow Instant Mami Beef/Chicken",unit:"55g",price:7.75,category:"Instant Noodles"},
 {name:"Lorins Patis PET Bottle",unit:"350mL",price:23.25,category:"Condiments"},
 {name:"Datu Puti Patis - Supermarket",unit:"350mL",price:27.00,category:"Condiments"},
 {name:"Datu Puti Soy Sauce - Supermarket",unit:"350mL",price:19.75,category:"Condiments"},
 {name:"Silver Swan Soy Sauce - Supermarket",unit:"350mL",price:20.75,category:"Condiments"},
 {name:"Green Cross Pure Care Toilet Soap",unit:"55g",price:15.00,category:"Personal Care"},
 {name:"Safeguard Pure White Toilet Soap",unit:"55g",price:22.00,category:"Personal Care"},
 {name:"Palmolive Naturals Toilet Soap",unit:"55g",price:17.00,category:"Personal Care"},
 {name:"Argentina Meat Loaf",unit:"150g",price:23.75,category:"Canned Meat"},
 {name:"Star Corned Beef",unit:"150g",price:34.00,category:"Canned Meat"},
 {name:"Young's Town Premium",unit:"150g",price:34.25,category:"Canned Meat"},
 {name:"Purefoods Chinese Style Luncheon Meat",unit:"165g",price:33.50,category:"Canned Meat"},
 {name:"CDO Chinese Style Luncheon Meat",unit:"165g",price:41.00,category:"Canned Meat"},
 {name:"Eveready Heavy Duty Red",unit:"2 D batteries",price:51.25,category:"Batteries"},
 {name:"Eveready Super Heavy Duty Black",unit:"2 D batteries",price:77.75,category:"Batteries"},
 {name:"Eveready Heavy Duty Small Red",unit:"2 AA batteries",price:27.00,category:"Batteries"},
 {name:"Energizer Max",unit:"4 AA batteries",price:206.25,category:"Batteries"}
];

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
async function fetchText(url,timeout=12000){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeout);
 try{
  const isJina=/^https:\/\/r\.jina\.ai\//i.test(url);
  const headers={
   "user-agent":"Mozilla/5.0 (compatible; MXGroceryWatch/3.0)",
   "accept":"text/plain,text/html,application/xhtml+xml,*/*",
   "cache-control":"no-cache"
  };
  if(isJina){
   headers["x-no-cache"]="true";
   headers["x-cache-tolerance"]="0";
   headers["x-timeout"]="20";
  }
  const r=await fetch(url,{headers,signal:ctrl.signal,cf:{cacheTtl:0,cacheEverything:false}});
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
 return arr[0]||null;
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
 const freshKey=new Request(url.origin+"/api/grocery-cache-v5");
 const lkgKey=new Request(url.origin+"/api/grocery-last-good-v1");

 if(!force){
  const hit=await cache.match(freshKey);
  if(hit)return hit;
 }

 try{
  let landing="";
  try{landing=await readable(LANDING)}catch(e){}
  const pdf=discoverPdf(landing);
  if(!pdf)throw new Error("No current DTI SRP bulletin PDF discovered");
  const md=await readable(pdf);
  let items=parseMarkdown(md);
  if(items.length<40)items=parseLoose(md);
  if(items.length<40)throw new Error("DTI SRP parser returned only "+items.length+" products");

  const updated=dateLabel(md);
  const yearMatch=(updated+" "+pdf).match(/20\d{2}/g);
  const newestYear=yearMatch?Math.max(...yearMatch.map(Number)):0;
  if(newestYear && newestYear<2026)throw new Error("Discovered DTI bulletin is older than 2026");

  const data={
   ok:true,live:true,fallback:false,stale:false,
   source:"Department of Trade and Industry • SRP Bulletin",
   source_url:pdf,
   landing_url:LANDING,
   updated,
   checked_at:new Date().toISOString(),
   count:items.length,
   items:rank(items)
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
     return new Response(JSON.stringify({...j,ok:true,live:false,fallback:true,stale:true,checked_at:new Date().toISOString(),note:"Current DTI source could not be refreshed — last verified official SRP list kept.",error:String(e)}),{status:200,headers:{
      "content-type":"application/json; charset=utf-8",
      "cache-control":"public, max-age=60, s-maxage=60",
      "access-control-allow-origin":"*"
     }});
    }
   }catch{}
  }
  return new Response(JSON.stringify({
   ok:false,live:false,fallback:false,stale:true,
   source:"Department of Trade and Industry • SRP Bulletin",
   landing_url:LANDING,
   checked_at:new Date().toISOString(),
   error:String(e)
  }),{status:502,headers:{
   "content-type":"application/json; charset=utf-8",
   "cache-control":"no-store",
   "access-control-allow-origin":"*"
  }});
 }
}
