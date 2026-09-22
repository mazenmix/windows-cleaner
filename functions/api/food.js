const DA_PAGE="https://www.da.gov.ph/price-monitoring/";
const BANTAY_BASE="https://www.bantaypresyo.da.gov.ph/";

const BANTAY_PAGES=[
  ["Rice","tbl_rice.php"],
  ["Meat","tbl_meat.php"],
  ["Vegetables","tbl_veg.php"],
  ["Fish","tbl_fish.php"],
  ["Fruits","tbl_fruits.php"],
  ["Other Commodities","tbl_other.php"],
  ["Other Commodities","tbl_others.php"]
];

function decodeHtml(s){
  return String(s||"")
    .replace(/<br\s*\/?>/gi," ")
    .replace(/&nbsp;|&#160;/gi," ")
    .replace(/&amp;/gi,"&")
    .replace(/&quot;|&#34;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'")
    .replace(/&lt;/gi,"<")
    .replace(/&gt;/gi,">")
    .replace(/&#8369;|&peso;/gi,"₱")
    .replace(/<[^>]+>/g," ")
    .replace(/\s+/g," ")
    .trim();
}
function n(v){
  if(v==null)return null;
  const x=Number(String(v).replace(/[,₱P\s]/g,""));
  return Number.isFinite(x)?x:null;
}
function unitFromText(s){
  const t=String(s||"").toLowerCase();
  if(/per\s*(pc|piece)|\/\s*(pc|piece)|\bpc\b/.test(t))return"pc";
  if(/per\s*liter|\/\s*l\b|\bliter\b/.test(t))return"L";
  if(/tray/.test(t))return"tray";
  if(/dozen/.test(t))return"dozen";
  if(/bundle/.test(t))return"bundle";
  return"kg";
}
function sanePrice(v){return Number.isFinite(v)&&v>0&&v<10000}
function cleanName(s){
  return decodeHtml(s)
    .replace(/^\d+\s*[.)-]?\s*/,"")
    .replace(/\s{2,}/g," ")
    .trim();
}

function parseHtmlTables(html,category){
  const rows=[];
  const trs=String(html||"").match(/<tr\b[\s\S]*?<\/tr>/gi)||[];
  let headers=[];
  for(const tr of trs){
    const cells=[...tr.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>decodeHtml(m[1]));
    if(cells.length<2)continue;

    const lower=cells.map(x=>x.toLowerCase());
    if(cells.some(x=>/commodity|product|item|price|prevailing|retail|unit|specification/i.test(x))){
      if(cells.filter(x=>/[a-z]/i.test(x)).length>=2) headers=lower;
    }

    let nameIndex=headers.findIndex(h=>/commodity|product|item|description|variety/.test(h));
    if(nameIndex<0)nameIndex=cells.findIndex(x=>/[A-Za-z]/.test(x)&&!/^(as of|date|market|unit|price|prevailing|retail|low|high|min|max)$/i.test(x));
    if(nameIndex<0)continue;

    let name=cleanName(cells[nameIndex]);
    if(!name||name.length<2||/commodity|product|item|prevailing|retail price|market|date/i.test(name))continue;

    let priceIndex=headers.findIndex(h=>/prevailing.*price|average.*price|retail.*price|price/.test(h));
    let price=null;
    if(priceIndex>=0&&priceIndex<cells.length) price=n(cells[priceIndex]);

    if(!sanePrice(price)){
      const candidates=[];
      cells.forEach((c,i)=>{
        if(i===nameIndex)return;
        const ms=[...c.matchAll(/(?:₱|PHP|PhP|P)?\s*(\d{1,4}(?:,\d{3})*(?:\.\d{1,2})?)/gi)];
        ms.forEach(m=>{
          const v=n(m[1]);
          if(sanePrice(v))candidates.push(v);
        });
      });
      if(candidates.length)price=candidates[candidates.length-1];
    }

    if(!sanePrice(price))continue;
    rows.push({
      category,
      name,
      price,
      unit:unitFromText(cells.join(" ")),
      change_pct:null
    });
  }

  const seen=new Set();
  return rows.filter(x=>{
    const k=(x.category+"|"+x.name).toLowerCase();
    if(seen.has(k))return false;
    seen.add(k);return true;
  });
}

function parseMarkdownTable(text,category){
  const rows=[];
  const lines=String(text||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  for(const line of lines){
    if(!line.includes("|"))continue;
    const parts=line.split("|").map(x=>x.trim()).filter(Boolean);
    if(parts.length<2)continue;
    if(parts.every(x=>/^:?-{2,}:?$/.test(x)))continue;
    if(parts.some(x=>/commodity|product|item|prevailing retail price|average retail price/i.test(x)))continue;

    let nameIndex=parts.findIndex(x=>/[A-Za-z]/.test(x)&&!/^(php|php\/kg|kg|pc|piece|unit|low|high|min|max)$/i.test(x));
    if(nameIndex<0)continue;
    let name=cleanName(parts[nameIndex]);
    if(!name||name.length<2)continue;

    const nums=[];
    parts.forEach((p,i)=>{
      if(i===nameIndex)return;
      [...p.matchAll(/(?:₱|PHP|PhP|P)?\s*(\d{1,4}(?:,\d{3})*(?:\.\d{1,2})?)/gi)].forEach(m=>{
        const v=n(m[1]);if(sanePrice(v))nums.push(v);
      });
    });
    if(!nums.length)continue;
    const price=nums[nums.length-1];
    rows.push({category,name,price,unit:unitFromText(parts.join(" ")),change_pct:null});
  }
  const seen=new Set();
  return rows.filter(x=>{
    const k=(x.category+"|"+x.name).toLowerCase();
    if(seen.has(k))return false;seen.add(k);return true;
  });
}

async function fetchText(url,timeout=12000){
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),timeout);
  try{
    const r=await fetch(url,{
      headers:{
        "user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153 Safari/537.36",
        "accept":"text/html,text/plain,application/xhtml+xml,*/*"
      },
      signal:ctrl.signal
    });
    if(!r.ok)throw new Error("HTTP "+r.status+" "+url);
    return await r.text();
  }finally{clearTimeout(timer)}
}

async function loadBantay(){
  const out=[];
  let date=null;
  const tasks=BANTAY_PAGES.map(async([category,path])=>{
    const url=BANTAY_BASE+path;
    try{
      const html=await fetchText(url,9000);
      const m=html.match(/As of\s*([^<\r\n]+)/i);
      if(m&&!date)date=decodeHtml(m[1]);
      let rows=parseHtmlTables(html,category);
      if(rows.length)return rows;
    }catch{}

    try{
      const text=await fetchText("https://r.jina.ai/http://www.bantaypresyo.da.gov.ph/"+path,12000);
      const m=text.match(/As of\s*([^\n\r]+)/i);
      if(m&&!date)date=decodeHtml(m[1]);
      return parseMarkdownTable(text,category);
    }catch{return[]}
  });

  for(const arr of await Promise.all(tasks))out.push(...arr);

  const seen=new Set();
  const items=out.filter(x=>{
    const k=(x.category+"|"+x.name).toLowerCase();
    if(seen.has(k))return false;seen.add(k);return true;
  });

  if(items.length<5)throw new Error("Bantay Presyo returned insufficient data");
  return{
    source:"DA Bantay Presyo",
    source_url:BANTAY_BASE,
    date,
    items
  };
}

function extractDpiLinks(text){
  const urls=[];
  const re=/(https?:\/\/[^\s"'<>]+(?:DPI|Daily[^\/\s]*Price[^\/\s]*Index)[^\s"'<>]*\.pdf)/gi;
  let m;
  while((m=re.exec(String(text||"")))){
    const u=m[1].replace(/[),.;]+$/,"");
    if(!urls.includes(u))urls.push(u);
  }

  if(!urls.length){
    const hrefRe=/href=["']([^"']+\.pdf[^"']*)["']/gi;
    while((m=hrefRe.exec(String(text||"")))){
      const raw=m[1].replace(/&amp;/g,"&");
      if(/DPI|price[-_\s]*index/i.test(raw)){
        try{
          const u=new URL(raw,DA_PAGE).href;
          if(!urls.includes(u))urls.push(u);
        }catch{}
      }
    }
  }
  return urls;
}

function generatedDpiCandidates(){
  const out=[];
  // Manila is UTC+8. Try today and previous 8 days because DA may publish with a 1-day lag.
  const now=new Date(Date.now()+8*3600*1000);
  const months=["January","February","March","April","May","June","July","August","September","October","November","December"];
  for(let i=0;i<9;i++){
    const d=new Date(now.getTime()-i*86400000);
    const y=d.getUTCFullYear(),mo=d.getUTCMonth()+1,day=d.getUTCDate(),month=months[d.getUTCMonth()];
    const mm=String(mo).padStart(2,"0");
    out.push("https://www.da.gov.ph/wp-content/uploads/"+y+"/"+mm+"/"+month+"-"+day+"-"+y+"-DPI-AFC.pdf");
  }
  return out;
}

async function discoverDpiLinks(){
  const all=[];
  try{
    const html=await fetchText(DA_PAGE,12000);
    all.push(...extractDpiLinks(html));
  }catch{}
  if(all.length<2){
    try{
      const md=await fetchText("https://r.jina.ai/https://www.da.gov.ph/price-monitoring/",15000);
      all.push(...extractDpiLinks(md));
    }catch{}
  }
  all.push(...generatedDpiCandidates());
  return [...new Set(all)];
}

async function pdfText(url){
  const readers=[
    "https://r.jina.ai/"+url,
    "https://r.jina.ai/http://"+url.replace(/^https?:\/\//,"")
  ];
  let last;
  for(const u of readers){
    try{
      const text=await fetchText(u,18000);
      if(text&&text.length>500)return text;
    }catch(e){last=e}
  }
  throw last||new Error("PDF reader failed");
}

function parseDpiText(text){
  const items=parseMarkdownTable(text,"DA Daily Price Index");
  if(items.length>=5)return items;

  // Fallback for plain OCR-style numbered rows.
  const lines=String(text||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const out=[];
  for(const line of lines){
    const m=line.match(/^\|?\s*(\d{1,3})\s*[|.)-]?\s+(.+)$/);
    if(!m)continue;
    const body=m[2];
    const nums=[...body.matchAll(/(?:₱|PHP|PhP|P)?\s*(\d{1,4}(?:,\d{3})*(?:\.\d{1,2})?)/gi)]
      .map(x=>n(x[1])).filter(sanePrice);
    if(!nums.length)continue;
    let name=cleanName(body.replace(/(?:₱|PHP|PhP|P)?\s*\d[\d,.]*(?:\s*[-–]\s*\d[\d,.]*)?.*$/i,""));
    if(!name||name.length<2)continue;
    out.push({category:"DA Daily Price Index",name,price:nums[nums.length-1],unit:unitFromText(body),change_pct:null});
  }
  return out;
}

async function loadDpi(){
  const links=await discoverDpiLinks();
  let latest=null,previous=null;

  for(const url of links){
    try{
      const text=await pdfText(url);
      const items=parseDpiText(text);
      if(items.length<5)continue;
      const dm=text.match(/Date of Monitoring:\s*([^\n\r]+)/i);
      const pack={url,text,items,date:dm?decodeHtml(dm[1]):null};
      if(!latest){latest=pack;continue}
      previous=pack;break;
    }catch{}
  }
  if(!latest)throw new Error("No readable DA Daily Price Index found");

  if(previous){
    const pmap=new Map(previous.items.map(x=>[x.name.toLowerCase(),x.price]));
    latest.items=latest.items.map(x=>{
      const p=pmap.get(x.name.toLowerCase());
      if(!sanePrice(p))return x;
      const pct=((x.price-p)/p)*100;
      return{...x,previous_price:p,change_pct:Number(pct.toFixed(2))};
    });
  }

  return{
    source:"Department of Agriculture – Daily Price Index",
    source_url:latest.url,
    date:latest.date,
    items:latest.items
  };
}

export async function onRequestGet(){
  const errors=[];

  try{
    const data=await loadBantay();
    return new Response(JSON.stringify({
      ok:true,
      source:data.source,
      scope:"Philippine agricultural and basic commodity monitoring",
      source_url:data.source_url,
      date:data.date,
      updated_at:new Date().toISOString(),
      count:data.items.length,
      items:data.items
    }),{
      headers:{
        "content-type":"application/json; charset=utf-8",
        "cache-control":"public, max-age=600, s-maxage=600",
        "access-control-allow-origin":"*"
      }
    });
  }catch(e){errors.push("Bantay Presyo: "+String(e))}

  try{
    const data=await loadDpi();
    return new Response(JSON.stringify({
      ok:true,
      source:data.source,
      scope:"Selected wet markets in the National Capital Region",
      source_url:data.source_url,
      date:data.date,
      updated_at:new Date().toISOString(),
      count:data.items.length,
      items:data.items,
      fallback_used:true
    }),{
      headers:{
        "content-type":"application/json; charset=utf-8",
        "cache-control":"public, max-age=900, s-maxage=900",
        "access-control-allow-origin":"*"
      }
    });
  }catch(e){errors.push("DA DPI: "+String(e))}

  return new Response(JSON.stringify({
    ok:false,
    error:errors.join(" | "),
    updated_at:new Date().toISOString()
  }),{
    status:502,
    headers:{
      "content-type":"application/json; charset=utf-8",
      "cache-control":"no-store",
      "access-control-allow-origin":"*"
    }
  });
}
