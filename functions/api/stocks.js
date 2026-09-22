export async function onRequestGet() {
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
        return new Response(JSON.stringify({
          ok: true,
          source: "TradingView",
          delayed_minutes: 15,
          updated_at: new Date().toISOString(),
          quotes
        }), {
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "public, max-age=45, s-maxage=45",
            "access-control-allow-origin": "*"
          }
        });
      }

      lastError = endpoint + " -> empty data";
    } catch (err) {
      lastError = endpoint + " -> " + String(err);
    }
  }

  return new Response(JSON.stringify({
    ok: false,
    error: lastError,
    updated_at: new Date().toISOString()
  }), {
    status: 502,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*"
    }
  });
}
