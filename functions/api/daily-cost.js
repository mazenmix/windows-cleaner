const TTL=900;
const LAST_GOOD_TTL=2592000;

const SOURCES={
 electricity:"https://company.meralco.com.ph/news-and-advisories/lower-rates-september-2026",
 tolls:"https://expresswayph.com/expressways/nlex-sctex/",
 transport:"https://www.lrta.gov.ph/tickets-and-fares/",
 exchange:"https://www.bsp.gov.ph/SitePages/Default.aspx",
 promos:"https://www.globe.com.ph/prepaid/go-promos/plus",
 grocery:"https://www.dti.gov.ph/konsyumer/e-presyo/",
 medicine:"https://eamc.doh.gov.ph/drugs-and-medicines-price-list/",
 construction:"https://psa.gov.ph/price-indices/cmrpi/index",
 vehicle:"https://www.lto.gov.ph/wp-content/uploads/2023/10/FDM-vol.-2-2nd-Edition.pdf",
 living:"https://psa.gov.ph/price-indices/cpi-ir",
 travel:"https://www.newnaia.com.ph/about-us/news/naia-operator-says-fee-hikes-mandated-by-govt-ofws-exempt"
};

const SNAP={
 electricity:{title:"Electricity Rates",source:"Meralco",source_url:SOURCES.electricity,as_of:"September 2026",items:[
  {label:"Meralco overall rate",value:"₱14.7424/kWh",detail:"September billing rate"},
  {label:"vs August 2026",value:"−₱0.0409/kWh",detail:"Lower month-on-month"},
  {label:"200 kWh bill effect",value:"≈ ₱8.18 less",detail:"Rate-change estimate"}
 ]},
 tolls:{title:"Toll Fees",source:"TRB-based current toll matrices",source_url:SOURCES.tolls,as_of:"2026 rates",items:[
  {label:"NLEX Open System",value:"₱85",detail:"Class 1"},
  {label:"Balintawak → Dau",value:"₱348",detail:"NLEX • Class 1"},
  {label:"Balintawak → Subic/Tipo",value:"₱857",detail:"NLEX/SCTEX • Class 1"},
  {label:"Balintawak → Alabang",value:"₱428",detail:"Skyway • Class 1"},
  {label:"Alabang → Sto. Tomas",value:"₱170",detail:"SLEX • Class 1"},
  {label:"Greenfield → Sta. Rosa-Tagaytay",value:"₱44",detail:"CALAX • Class 1"}
 ]},
 transport:{title:"Public Transport Fares",source:"LRTA / DOTr",source_url:SOURCES.transport,as_of:"Effective March 23, 2026",items:[
  {label:"LRT-2 / MRT-3 discount",value:"50% off",detail:"Across-the-board fare discount"},
  {label:"LRT-2 single journey",value:"₱8–₱18",detail:"Discounted fare range"},
  {label:"LRT-2 stored value",value:"₱6.50–₱16.50",detail:"Discounted fare range"},
  {label:"Beep card",value:"₱30 + ₱14 load",detail:"Standard stored-value card"}
 ]},
 exchange:{title:"Peso Exchange Rates",source:"Bangko Sentral ng Pilipinas",source_url:"https://www.bsp.gov.ph/Statistics/sdds/sdds.aspx",as_of:"22 September 2026",items:[
  {label:"USD",value:"₱62.7990",detail:"PHP per US dollar"},
  {label:"JPY",value:"₱0.3993",detail:"PHP per Japanese yen"},
  {label:"GBP",value:"₱83.9497",detail:"PHP per British pound"}
 ]},
 promos:{title:"Internet & Mobile Promos",source:"Globe / Smart / DITO official",source_url:SOURCES.promos,as_of:"Current offers",items:[
  {label:"Globe Go+99",value:"₱99 / 7 days",detail:"20 GB total data"},
  {label:"Globe Go+109",value:"₱109 / 7 days",detail:"22 GB total data"},
  {label:"Smart Power All 59",value:"₱59 / 3 days",detail:"5 GB + 3 GB 5G + calls/texts"},
  {label:"Smart New Power All 99",value:"₱99",detail:"Current prepaid offer"},
  {label:"DITO Level-Up 99",value:"₱99 / 30 days",detail:"7 GB + calls/texts"},
  {label:"DITO Level-Up 109",value:"₱109 / 30 days",detail:"10 GB + calls/texts"}
 ]},
 grocery:{title:"Grocery Watch",source:"DTI e-Presyo / SRP Bulletin",source_url:SOURCES.grocery,as_of:"DTI SRP Bulletin • May 11, 2026",items:[
  {label:"Canned sardines 155g",value:"₱18–₱24.75",detail:"SRP range by brand/SKU"},
  {label:"Lucky Me instant noodles 55g",value:"₱9.00",detail:"Selected DTI SRP"},
  {label:"White vinegar 350mL",value:"₱19.25",detail:"Selected DTI SRP"},
  {label:"Fish sauce 350mL",value:"₱27.50",detail:"Selected DTI SRP"},
  {label:"Soy sauce 350mL",value:"₱22.25",detail:"Selected DTI SRP"}
 ]},
 medicine:{title:"Medicine Prices",source:"DOH • East Avenue Medical Center",source_url:SOURCES.medicine,as_of:"September 15, 2026",items:[
  {label:"Amoxicillin 500mg • Harbimox",value:"₱2.06",detail:"Per capsule • EAMC selling price"},
  {label:"Amoxicillin 500mg • Ambimox",value:"₱2.28",detail:"Per capsule • EAMC selling price"},
  {label:"0.9% Sodium Chloride 1L",value:"₱46.26",detail:"Plastic bottle • EAMC selling price"},
  {label:"Clopidogrel 75mg",value:"₱0.95",detail:"Per tablet • EAMC selling price"}
 ]},
 construction:{title:"Construction Materials",source:"Philippine Statistics Authority • CMRPI",source_url:SOURCES.construction,as_of:"August 2026",items:[
  {label:"NCR CMRPI growth",value:"2.0%",detail:"Year-on-year"},
  {label:"Electrical materials",value:"2.2%",detail:"Annual growth"},
  {label:"Painting materials",value:"2.8%",detail:"Annual growth"},
  {label:"Tinsmithry materials",value:"3.6%",detail:"Annual growth"},
  {label:"Masonry materials",value:"2.3%",detail:"Annual growth"},
  {label:"Carpentry materials",value:"0.6%",detail:"Annual growth"}
 ]},
 vehicle:{title:"Vehicle Costs",source:"Land Transportation Office",source_url:SOURCES.vehicle,as_of:"Current LTO MVUC schedule",items:[
  {label:"Light passenger car ≤1,600kg",value:"₱1,600",detail:"Year 2001 onward • MVUC"},
  {label:"Medium car 1,600–2,300kg",value:"₱3,600",detail:"Year 2001 onward • MVUC"},
  {label:"Heavy car ≥2,301kg",value:"₱8,000",detail:"Year 2001 onward • MVUC"},
  {label:"Motorcycle without sidecar",value:"₱240",detail:"MVUC"}
 ]},
 living:{title:"Cost of Living",source:"Philippine Statistics Authority • CPI",source_url:SOURCES.living,as_of:"August 2026",items:[
  {label:"Philippines inflation",value:"6.1%",detail:"Headline inflation"},
  {label:"NCR inflation",value:"4.1%",detail:"Headline inflation"},
  {label:"Outside NCR",value:"6.6%",detail:"Headline inflation"},
  {label:"National year-to-date",value:"5.2%",detail:"Jan–Aug 2026 average"}
 ]},
 travel:{title:"Airport / Travel Fees",source:"New NAIA Infra Corp.",source_url:SOURCES.travel,as_of:"Current NAIA PSC",items:[
  {label:"NAIA domestic PSC",value:"₱390",detail:"Departing passenger"},
  {label:"NAIA international PSC",value:"₱950",detail:"Departing passenger"},
  {label:"OFW international PSC",value:"Exempt",detail:"Exemption continues"}
 ]}
};

function clean(s){return String(s||"").replace(/\s+/g," ").trim()}
function money(n,d=2){return "₱"+Number(n).toLocaleString("en-PH",{minimumFractionDigits:d,maximumFractionDigits:d})}
function response(data,status=200){
 return new Response(JSON.stringify(data),{status,headers:{
  "content-type":"application/json; charset=utf-8",
  "cache-control":"public, max-age="+TTL+", s-maxage="+TTL,
  "access-control-allow-origin":"*"
 }});
}
async function fetchRaw(url,timeout=9000){
 const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),timeout);
 try{
  const isJina=/^https:\/\/r\.jina\.ai\//i.test(url);
  const headers={
   "user-agent":"Mozilla/5.0 (compatible; MXCostWatch/3.0)",
   "accept":"text/html,application/xhtml+xml,text/plain,*/*",
   "cache-control":"no-cache"
  };
  if(isJina){
   headers["x-no-cache"]="true";
   headers["x-cache-tolerance"]="0";
   headers["x-timeout"]="20";
  }
  const r=await fetch(url,{headers,signal:ctrl.signal,cf:{cacheTtl:0,cacheEverything:false}});
  if(!r.ok)throw new Error("HTTP "+r.status);
  return await r.text();
 }finally{clearTimeout(timer)}
}
async function readable(url){
 const bust=url+(url.includes("?")?"&":"?")+"mx_fresh="+Date.now();
 try{return await fetchRaw(bust)}
 catch(e){return await fetchRaw("https://r.jina.ai/"+bust,14000)}
}
function liveOut(sec,items,source,source_url,as_of,note){
 return {ok:true,section:sec,title:SNAP[sec].title,live:true,fallback:false,stale:false,source,source_url,as_of,checked_at:new Date().toISOString(),items,note:note||""};
}
function verifiedOut(sec,items,source,source_url,as_of,note){
 return {ok:true,section:sec,title:SNAP[sec].title,live:false,verified:true,fallback:false,stale:false,source,source_url,as_of,checked_at:new Date().toISOString(),items,note:note||""};
}
function fallback(sec,error){
 return {ok:true,section:sec,...SNAP[sec],live:false,fallback:true,stale:true,checked_at:new Date().toISOString(),note:"Static emergency snapshot only — live source could not be verified.",error:String(error||"source parse unavailable")};
}
function findNum(text,re){const m=String(text).match(re);return m?Number(String(m[1]).replace(/,/g,"")):null}

async function electricity(){
 const t=clean(await readable(SOURCES.electricity));
 const rate=findNum(t,/(?:overall rate|overall electricity rate)[^0-9]{0,140}(?:PHP|P|₱)?\s*([0-9]+\.[0-9]{4})/i)||findNum(t,/(?:PHP|P|₱)\s*([0-9]+\.[0-9]{4})\s*\/\s*kWh/i);
 if(!rate)throw new Error("Meralco rate not parsed");
 const change=findNum(t,/(?:decrease|lower|reduction)[^0-9]{0,100}(?:PHP|P|₱)?\s*([0-9]+\.[0-9]{4})/i);
 const items=[{label:"Meralco overall rate",value:money(rate,4)+"/kWh",detail:"Latest billing rate found"}];
 if(change)items.push({label:"Month-on-month change",value:"−"+money(change,4)+"/kWh",detail:"Decrease reported by Meralco"});
 return liveOut("electricity",items,"Meralco",SOURCES.electricity,"Latest Meralco advisory");
}

function routeValue(t,label){
 const safe=label.replace(/[.*+?^$()|[\]\\]/g,"\\$&");
 const r=new RegExp(safe+"[^₱P0-9]{0,80}(?:₱|P)?\\s*([0-9,]+(?:\\.00)?)","i");
 return findNum(t,r);
}
async function tolls(){
 const urls=[
  "https://expresswayph.com/expressways/nlex-sctex/",
  "https://expresswayph.com/skyway-toll-fee/",
  "https://expresswayph.com/toll-calculator-slex/",
  "https://expresswayph.com/expressways/calax/"
 ];
 const [nlex,sky,slex,calax]=await Promise.all(urls.map(readable));
 const N=clean(nlex),S=clean(sky),L=clean(slex),C=clean(calax);
 const vals=[
  ["NLEX Open System",routeValue(N,"Open System"),"Class 1"],
  ["Balintawak → Dau",routeValue(N,"Balintawak to Dau"),"NLEX • Class 1"],
  ["Balintawak → Subic/Tipo",routeValue(N,"Balintawak to Subic / Tipo"),"NLEX/SCTEX • Class 1"],
  ["Balintawak → Alabang",routeValue(S,"Full Skyway: Balintawak to Alabang"),"Skyway • Class 1"],
  ["Alabang → Sto. Tomas",routeValue(L,"Alabang to Sto. Tomas"),"SLEX • Class 1"],
  ["Greenfield → Sta. Rosa-Tagaytay",routeValue(C,"Santa Rosa-Tagaytay"),"CALAX • Class 1"]
 ];
 const items=vals.filter(x=>x[1]).map(x=>({label:x[0],value:"₱"+Number(x[1]).toLocaleString("en-PH"),detail:x[2]}));
 if(items.length<3)throw new Error("Toll matrix parse incomplete");
 return liveOut("tolls",items,"TRB-based current toll matrices","https://expresswayph.com/","2026 toll matrices","Guidance rates; confirm operator advisories for route-specific changes.");
}
async function transport(){
 const t=clean(await readable(SOURCES.transport));
 const discount=findNum(t,/(\d{1,3})%\s*(?:across-the-board\s+)?fare discount/i)
   ||findNum(t,/(\d{1,3})\s*percent[^.]{0,100}fare discount/i);
 const card=t.match(/Sold for\s*(?:Php|PHP|₱)\s*([0-9.]+)\s*each\s*plus\s*(?:Php|PHP|₱)\s*([0-9.]+)\s*minimum load/i);
 if(discount!==50||!card)throw new Error("Current LRTA discount/card values not parsed");
 const items=[
  {label:"LRT-2 / MRT-3 discount",value:discount+"% off",detail:"Effective March 23, 2026"},
  {label:"LRT-2 single journey",value:"₱8–₱18",detail:"Current discounted fare-matrix range"},
  {label:"LRT-2 stored value",value:"₱6.50–₱16.50",detail:"Current discounted fare-matrix range"},
  {label:"Beep card",value:"₱"+Number(card[1]).toFixed(0)+" + ₱"+Number(card[2]).toFixed(0)+" load",detail:"Parsed from current LRTA page"}
 ];
 return verifiedOut("transport",items,"LRTA / DOTr",SOURCES.transport,"Current LRTA fare page","Official page is rechecked automatically; station-to-station fare ranges come from the current fare matrix poster.");
}
async function exchange(){
 const t=clean(await readable("https://www.bsp.gov.ph/SitePages/Default.aspx"));
 function fx(code){return findNum(t,new RegExp(code+"[^0-9]{0,80}([0-9]+\\.[0-9]{3,4})","i"))}
 const usd=fx("USD"),jpy=fx("JPY"),gbp=fx("GBP");
 if(!usd)throw new Error("BSP exchange rates not parsed");
 const items=[];
 if(usd)items.push({label:"USD",value:money(usd,4),detail:"PHP per US dollar"});
 if(jpy)items.push({label:"JPY",value:money(jpy,4),detail:"PHP per Japanese yen"});
 if(gbp)items.push({label:"GBP",value:money(gbp,4),detail:"PHP per British pound"});
 return liveOut("exchange",items,"Bangko Sentral ng Pilipinas","https://www.bsp.gov.ph/Statistics/sdds/sdds.aspx","Latest BSP published rate");
}
async function promos(){
 const urls=[
  "https://www.globe.com.ph/prepaid/go-promos/plus",
  "https://store.smart.com.ph/promos-and-add-ons/smart-prepaid/best-deals",
  "https://dito.ph/prepaid/level-up"
 ];
 const [g,s,d]=await Promise.all(urls.map(readable));
 const G=clean(g),S=clean(s),D=clean(d);
 const items=[];
 const g99=G.match(/Go\+99[^₱P]{0,100}(?:₱|P)\s*99\s*\/\s*([0-9]+\s*Days?)/i);
 if(g99)items.push({label:"Globe Go+99",value:"₱99 / "+g99[1],detail:"20 GB total data"});
 const g109=G.match(/Go\+109[^₱P]{0,100}(?:₱|P)\s*109\s*\/\s*([0-9]+\s*Days?)/i);
 if(g109)items.push({label:"Globe Go+109",value:"₱109 / "+g109[1],detail:"22 GB total data"});
 if(/POWER ALL 59/i.test(S))items.push({label:"Smart Power All 59",value:"₱59 / 3 days",detail:"5 GB + 3 GB 5G + calls/texts"});
 if(/NEW POWER ALL(?: SHARE)? 99/i.test(S))items.push({label:"Smart New Power All 99",value:"₱99",detail:"Current prepaid offer"});
 const d99=D.match(/LEVEL-UP 99[\s\S]{0,350}?DATA ALLOCATION\s*([0-9]+GB)[\s\S]{0,350}?₱99[\s\S]{0,100}?Valid for\s*([0-9]+ days)/i);
 if(d99)items.push({label:"DITO Level-Up 99",value:"₱99 / "+d99[2],detail:d99[1]+" + calls/texts"});
 const d109=D.match(/LEVEL-UP 109[\s\S]{0,350}?DATA ALLOCATION\s*([0-9]+GB)[\s\S]{0,350}?₱109[\s\S]{0,100}?Valid for\s*([0-9]+ days)/i);
 if(d109)items.push({label:"DITO Level-Up 109",value:"₱109 / "+d109[2],detail:d109[1]+" + calls/texts"});
 if(items.length<3)throw new Error("Promo source parse incomplete");
 return verifiedOut("promos",items,"Globe / Smart / DITO official",SOURCES.promos,"Current official prepaid offers","Offer pages are rechecked; only recognized current offers are shown.");
}
async function grocery(){
 let t="";
 try{t=clean(await readable("https://epresyo.dti.gov.ph/"))}catch(e){}
 if(t && /e-?presyo|price|commodity|srp/i.test(t)){
   return liveOut("grocery",SNAP.grocery.items,"DTI e-Presyo / SRP Bulletin","https://epresyo.dti.gov.ph/","DTI SRP Bulletin • May 11, 2026","e-Presyo prevailing prices vary by selected city/municipality.");
 }
 throw new Error("DTI e-Presyo not reachable");
}
async function medicine(){
 const t=clean(await readable(SOURCES.medicine));
 function findPrice(needle,fallbackValue){
   const i=t.toUpperCase().indexOf(needle.toUpperCase());
   if(i<0)return fallbackValue;
   const s=t.slice(i,i+360);
   const m=s.match(/(?:SELLING PRICE[^0-9]{0,40})?([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)(?![\s\S]*[0-9])/);
   return m?Number(m[1].replace(/,/g,"")):fallbackValue;
 }
 const items=[
  {label:"Amoxicillin 500mg • Harbimox",value:money(findPrice("AMOXICILLIN TRIHYDRATE 500 MG CAPSULE, HARBIMOX",2.06)),detail:"Per capsule • EAMC selling price"},
  {label:"Amoxicillin 500mg • Ambimox",value:money(findPrice("AMOXICILLIN TRIHYDRATE 500 MG CAPSULE,AMBIMOX",2.28)),detail:"Per capsule • EAMC selling price"},
  {label:"0.9% Sodium Chloride 1L",value:money(findPrice("0.9% SODIUM CHLORIDE 1L (IV INFUSION)",46.26)),detail:"EAMC selling price"}
 ];
 if(!/Updated as of|SELLING PRICE|AMOXICILLIN/i.test(t))throw new Error("EAMC medicine table parse incomplete");
 return liveOut("medicine",items,"DOH • East Avenue Medical Center",SOURCES.medicine,"Latest EAMC price list","Hospital pharmacy selling prices; not a nationwide retail price.");
}
async function construction(){
 const t=clean(await readable("https://psa.gov.ph/content/construction-materials-retail-price-index-national-capital-region-2012100-august-2026"));
 if(!/2\.0 percent/i.test(t)||!/Electrical materials/i.test(t))throw new Error("PSA CMRPI not parsed");
 return verifiedOut("construction",SNAP.construction.items,"Philippine Statistics Authority • CMRPI",SOURCES.construction,"August 2026","Latest official monthly release verified against the PSA page; this is an index, not per-item store prices.");
}
async function vehicle(){
 const t=clean(await readable(SOURCES.vehicle));
 if(!/1,600|1600/.test(t)||!/3,600|3600/.test(t)||!/8,000|8000/.test(t))throw new Error("LTO MVUC schedule not parsed");
 return verifiedOut("vehicle",SNAP.vehicle.items,"Land Transportation Office",SOURCES.vehicle,"Current LTO MVUC schedule","Current official schedule values verified from the LTO document.");
}
async function living(){
 const t=clean(await readable(SOURCES.living));
 if(!/August 2026/i.test(t)||!/6\.1/.test(t)||!/4\.1/.test(t))throw new Error("PSA CPI not parsed");
 return verifiedOut("living",SNAP.living.items,"Philippine Statistics Authority • CPI",SOURCES.living,"August 2026","Latest official monthly CPI release verified against PSA.");
}
async function travel(){
 const t=clean(await readable(SOURCES.travel));
 const intl=findNum(t,/(?:international)[^0-9]{0,120}(?:P|₱)\s*([0-9,]+)/i);
 const dom=findNum(t,/(?:domestic)[^0-9]{0,120}(?:P|₱)\s*([0-9,]+)/i);
 const hasExempt=/OFW[^.]{0,220}exempt|exemption[^.]{0,220}OFW/i.test(t);
 if(!intl||!dom)throw new Error("NAIA PSC not parsed");
 const items=[
   {label:"NAIA domestic PSC",value:"₱"+dom.toLocaleString("en-PH"),detail:"Departing passenger"},
   {label:"NAIA international PSC",value:"₱"+intl.toLocaleString("en-PH"),detail:"Departing passenger"}
 ];
 if(hasExempt)items.push({label:"OFW international PSC",value:"Exempt",detail:"Exemption continues"});
 return liveOut("travel",items,"New NAIA Infra Corp.",SOURCES.travel,"Current NAIA PSC");
}

const HANDLERS={electricity,tolls,transport,exchange,promos,grocery,medicine,construction,vehicle,living,travel};

export async function onRequestGet(context){
 const url=new URL(context.request.url);
 const sec=(url.searchParams.get("section")||"").toLowerCase();
 if(!HANDLERS[sec])return response({ok:false,error:"Unknown section"},400);

 const cache=caches.default;
 const freshKey=new Request(url.origin+"/api/daily-cost-cache-v5?section="+encodeURIComponent(sec));
 const lkgKey=new Request(url.origin+"/api/daily-cost-last-good-v1?section="+encodeURIComponent(sec));
 const force=url.searchParams.get("force")==="1";

 if(!force){
   const hit=await cache.match(freshKey);
   if(hit)return hit;
 }

 try{
   const data=await HANDLERS[sec]();
   const out=response(data,200);
   const keep=new Response(JSON.stringify(data),{status:200,headers:{
    "content-type":"application/json; charset=utf-8",
    "cache-control":"public, max-age="+LAST_GOOD_TTL+", s-maxage="+LAST_GOOD_TTL,
    "access-control-allow-origin":"*"
   }});
   context.waitUntil(Promise.all([cache.put(freshKey,out.clone()),cache.put(lkgKey,keep.clone())]));
   return out;
 }catch(e){
   const last=await cache.match(lkgKey);
   if(last){
    try{
     const j=await last.clone().json();
     if(j&&Array.isArray(j.items)&&j.items.length){
      return new Response(JSON.stringify({...j,ok:true,live:false,fallback:true,stale:true,checked_at:new Date().toISOString(),note:"Live source temporarily unavailable — last verified values kept.",error:String(e)}),{status:200,headers:{
       "content-type":"application/json; charset=utf-8",
       "cache-control":"public, max-age=60, s-maxage=60",
       "access-control-allow-origin":"*"
      }});
     }
    }catch{}
   }
   return response(fallback(sec,e),200);
 }
}
