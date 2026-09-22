const DA_PAGE = "https://www.da.gov.ph/price-monitoring/";

function absUrl(href){
  if(!href) return null;
  href = href.replace(/&amp;/g,"&");
  try { return new URL(href, DA_PAGE).href; } catch { return null; }
}

function discoverDailyIndexPdfs(html){
  const lower = html.toLowerCase();
  let start = lower.indexOf("daily price index");
  if(start < 0) start = 0;
  let end = lower.indexOf("daily cigarette price monitoring", start);
  if(end < 0) end = lower.indexOf("daily retail price range", start);
  if(end < 0) end = Math.min(html.length, start + 250000);
  const section = html.slice(start,end);

  const found=[];
  const re=/<a[^>]+href=["']([^"']+\.pdf(?:\?[^"']*)?)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while((m=re.exec(section))){
    const url=absUrl(m[1]);
    const label=m[2].replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
    if(url && /2026/i.test(url+label)) found.push({url,label});
  }
  // Preserve page order (newest first) and dedupe.
  const seen=new Set();
  return found.filter(x=>!seen.has(x.url) && seen.add(x.url));
}

function cleanLine(s){
  return s.replace(/\u00a0/g," ").replace(/[ \t]+/g," ").trim();
}

function parseDate(text){
  const m=text.match(/Date of Monitoring:\s*([^\n\r]+)/i) ||
          text.match(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(\d{1,2}\s+[A-Za-z]+\s+20\d{2})/i);
  return m ? cleanLine(m[1]) : null;
}

function cleanName(name){
  return cleanLine(name)
    .replace(/\s+\|.*$/,"")
    .replace(/[_*#]+/g,"")
    .replace(/\s{2,}/g," ")
    .replace(/\s+\($/,"")
    .trim();
}

function parseCommodityRows(text){
  const lines=text.split(/\r?\n/).map(cleanLine).filter(Boolean);
  const rows=[];
  let current=null;

  const flush=()=>{
    if(!current) return;
    const body=current.lines.join(" ");
    // Price is normally the final decimal/whole value in the row block.
    const nums=[...body.matchAll(/(?:₱|P)?\s*(\d{1,4}(?:,\d{3})*(?:\.\d{1,2})?)(?!\s*(?:pcs?|pieces?)\s*\/?\s*kg)/gi)]
      .map(x=>({raw:x[0],value:Number(x[1].replace(/,/g,"")),index:x.index||0}))
      .filter(x=>Number.isFinite(x.value));

    // Prefer decimal prices, then the last sensible numeric value.
    const decimals=nums.filter(x=>/\.\d{1,2}/.test(x.raw));
    const pick=(decimals.length?decimals:nums).slice(-1)[0];

    if(pick && pick.value>0 && pick.value<10000){
      let name=cleanName(current.name);
      // Add a short continuation only when the row name is visibly cut.
      if(/\b(or|and|with|fresh|local|imported)$/i.test(name) && current.lines.length){
        const extra=current.lines[0].replace(/\b\d+(?:\.\d+)?\b.*$/,"").trim();
        if(extra && extra.length<36) name=cleanName(name+" "+extra);
      }
      if(name && !/^(page|annex|commodity|specification|prevailing|price|unit)$/i.test(name)){
        rows.push({id:current.id,name,price:pick.value});
      }
    }
    current=null;
  };

  for(const line of lines){
    // Covers "15 Bangus" and markdown table rows beginning with row number.
    const m=line.match(/^\|?\s*(\d{1,3})\s*[|.)-]?\s+(.+?)\s*\|?$/);
    if(m){
      flush();
      current={id:Number(m[1]),name:m[2],lines:[]};
    }else if(current){
      // Stop obviously at footer/page markers but otherwise retain wrapped row text.
      if(/^page\s+\d+/i.test(line)) continue;
      current.lines.push(line);
    }
  }
  flush();

  // Deduplicate by numeric row id, which DA keeps stable within each daily index.
  const map=new Map();
  for(const r of rows) if(!map.has(r.id)) map.set(r.id,r);
  return [...map.values()].sort((a,b)=>a.id-b.id);
}

function inferUnit(name){
  const n=name.toLowerCase();
  if(/egg/.test(n)) return "pc";
  if(/coconut.*mature|coconut.*young/.test(n)) return "pc";
  if(/cooking oil/.test(n)) return "L";
  return "kg";
}

async function textFromPdf(url){
  const reader="https://r.jina.ai/"+url;
  const r=await fetch(reader,{
    headers:{
      "accept":"text/plain,text/markdown;q=0.9,*/*;q=0.8",
      "user-agent":"Mozilla/5.0"
    },
    cf:{cacheTtl:3600,cacheEverything:true}
  });
  if(!r.ok) throw new Error("Jina PDF reader HTTP "+r.status);
  return await r.text();
}

export async function onRequestGet(){
  try{
    const pageRes=await fetch(DA_PAGE,{
      headers:{"user-agent":"Mozilla/5.0","accept":"text/html,*/*"},
      cf:{cacheTtl:900,cacheEverything:true}
    });
    if(!pageRes.ok) throw new Error("DA price page HTTP "+pageRes.status);
    const html=await pageRes.text();
    const pdfs=discoverDailyIndexPdfs(html);
    if(!pdfs.length) throw new Error("No Daily Price Index PDFs found");

    const latest=pdfs[0];
    const previous=pdfs[1] || null;

    const latestText=await textFromPdf(latest.url);
    const latestRows=parseCommodityRows(latestText);
    if(latestRows.length<10) throw new Error("Could not parse enough commodity rows");

    let prevRows=[];
    if(previous){
      try{ prevRows=parseCommodityRows(await textFromPdf(previous.url)); }catch{}
    }
    const prevMap=new Map(prevRows.map(x=>[x.id,x]));

    const items=latestRows.map(x=>{
      const p=prevMap.get(x.id);
      const change=p && Number.isFinite(p.price) ? x.price-p.price : null;
      const changePct=p && p.price>0 ? (change/p.price)*100 : null;
      return {
        id:x.id,
        name:x.name,
        price:x.price,
        unit:inferUnit(x.name),
        previous_price:p?.price ?? null,
        change:Number.isFinite(change)?Number(change.toFixed(2)):null,
        change_pct:Number.isFinite(changePct)?Number(changePct.toFixed(2)):null
      };
    });

    return new Response(JSON.stringify({
      ok:true,
      source:"Department of Agriculture – Daily Price Index / Bantay Presyo",
      scope:"Selected wet markets in the National Capital Region",
      source_url:latest.url,
      previous_source_url:previous?.url || null,
      date:parseDate(latestText) || latest.label || null,
      previous_date:previous?.label || null,
      updated_at:new Date().toISOString(),
      count:items.length,
      items
    }),{
      headers:{
        "content-type":"application/json; charset=utf-8",
        "cache-control":"public, max-age=900, s-maxage=900",
        "access-control-allow-origin":"*"
      }
    });
  }catch(err){
    return new Response(JSON.stringify({
      ok:false,
      error:String(err),
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
}
