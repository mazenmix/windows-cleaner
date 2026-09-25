const FRESH_TTL=60;
const LAST_GOOD_TTL=2592000;

export async function onRequestGet(context) {
  const cache=caches.default;
  const u=new URL(context.request.url);
  const freshKey=new Request(u.origin+"/api/stocks-cache-v1");
  const lkgKey=new Request(u.origin+"/api/stocks-last-good-v1");
  if(u.searchParams.get("force")!=="1"){
    const hit=await cache.match(freshKey);
    if(hit)return hit;
  }

  const symbols = [
    ["PSEI","PSE:PSEI"],["SM","PSE:SM"],["SMPH","PSE:SMPH"],["BDO","PSE:BDO"],
    ["BPI","PSE:BPI"],["AC","PSE:AC"],["ALI","PSE:ALI"],["ICT","PSE:ICT"],
    ["JFC","PSE:JFC"],["TEL","PSE:TEL"],["GLO","PSE:GLO"],["MBT","PSE:MBT"],
    ["MER","PSE:MER"],["AEV","PSE:AEV"],["AP","PSE:AP"]
  ];

  const payload = {
    symbols: { tickers: symbols.map(x => x[1]), query: { types: [] } },
    columns: ["close", "change"],
    range: [0, symbols.length]
  };

  const endpoints = [
    "https://scanner.tradingview.com/philippines/scan",
    "https://scanner.tradingview.com/global/scan"
  ];

  let lastError = "No response";

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "accept": "application/json,text/plain,*/*",
          "content-type": "application/json",
          "user-agent": "Mozilla/5.0",
          "origin": "https://www.tradingview.com",
          "referer": "https://www.tradingview.com/"
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        lastError = endpoint + " -> HTTP " + res.status;
        continue;
      }

      const json = await res.json();
      const map = new Map((json.data || []).map(item => [item.s, item.d || []]));

      const quotes = symbols.map(([label, ticker]) => {
        const d = map.get(ticker);
        return {
          symbol: label,
          ticker,
          price: d && Number.isFinite(Number(d[0])) ? Number(d[0]) : null,
          change: d && Number.isFinite(Number(d[1])) ? Number(d[1]) : null
        };
      }).filter(x => x.price !== null);

      if (quotes.length) {
        const data={
          ok:true,
          live:true,
          stale:false,
          source:"TradingView",
          delayed_minutes:15,
          updated_at:new Date().toISOString(),
          quotes
        };
        const out=new Response(JSON.stringify(data),{
          headers:{
            "content-type":"application/json; charset=utf-8",
            "cache-control":"public, max-age="+FRESH_TTL+", s-maxage="+FRESH_TTL,
            "access-control-allow-origin":"*"
          }
        });
        const keep=new Response(JSON.stringify(data),{
          headers:{
            "content-type":"application/json; charset=utf-8",
            "cache-control":"public, max-age="+LAST_GOOD_TTL+", s-maxage="+LAST_GOOD_TTL,
            "access-control-allow-origin":"*"
          }
        });
        context.waitUntil(Promise.all([cache.put(freshKey,out.clone()),cache.put(lkgKey,keep.clone())]));
        return out;
      }

      lastError = endpoint + " -> empty data";
    } catch (err) {
      lastError = endpoint + " -> " + String(err);
    }
  }

  const last=await cache.match(lkgKey);
  if(last){
    try{
      const j=await last.clone().json();
      if(j&&Array.isArray(j.quotes)&&j.quotes.length){
        return new Response(JSON.stringify({...j,ok:true,live:false,stale:true,last_verified:true,checked_at:new Date().toISOString(),note:"TradingView temporarily unavailable — last verified market quotes kept.",error:lastError}),{
          status:200,
          headers:{
            "content-type":"application/json; charset=utf-8",
            "cache-control":"public, max-age=60, s-maxage=60",
            "access-control-allow-origin":"*"
          }
        });
      }
    }catch{}
  }
  return new Response(JSON.stringify({
    ok:false,
    live:false,
    stale:true,
    error:lastError,
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
