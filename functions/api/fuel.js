const FRESH_TTL = 30;
const LAST_GOOD_TTL = 2592000;
const SOURCE = "https://gaswatchph.com/";

// Safety snapshot only. The browser-rendered GasWatch table is canonical when
// available because GasWatch applies community/live adjustments in JavaScript.
const FALLBACK_FUEL = [
  {name:"Shell",stations:204,diesel:[105.73,7.80],premDiesel:[112.94,7.80],unleaded91:[93.68,4.80],eGas:null,prem95:[100.93,4.80],prem97:[107.21,4.80],kerosene:[132.85,6.40]},
  {name:"Petron",stations:240,diesel:[104.14,7.72],premDiesel:[107.22,7.80],unleaded91:[91.72,4.74],eGas:null,prem95:[92.75,4.77],prem97:[101.83,4.80],kerosene:[129.58,6.40]},
  {name:"Caltex",stations:131,diesel:[107.29,7.68],premDiesel:[111.55,7.68],unleaded91:[94.52,4.77],eGas:null,prem95:[101.65,4.70],prem97:[104.60,4.88],kerosene:[128.43,6.47]},
  {name:"Phoenix",stations:70,diesel:[108.35,7.82],premDiesel:null,unleaded91:[99.44,4.88],eGas:[105.38,4.88],prem95:[101.45,4.88],prem97:[104.85,4.88],kerosene:null},
  {name:"Seaoil",stations:71,diesel:[104.20,7.82],premDiesel:[110.23,7.82],unleaded91:[91.21,4.88],eGas:[117.06,4.88],prem95:[94.22,4.88],prem97:[94.78,4.88],kerosene:[134.56,6.47]},
  {name:"Unioil",stations:83,diesel:[103.11,7.45],premDiesel:null,unleaded91:[90.15,4.53],eGas:[114.28,4.80],prem95:[93.18,4.56],prem97:[108.99,4.80],kerosene:null},
  {name:"Jetti",stations:10,diesel:[104.91,6.80],premDiesel:null,unleaded91:[92.59,4.80],eGas:null,prem95:[96.51,4.80],prem97:[103.70,4.80],kerosene:null},
  {name:"Flying V",stations:38,diesel:[100.73,7.80],premDiesel:null,unleaded91:[86.84,4.80],eGas:null,prem95:[87.79,4.80],prem97:null,kerosene:null},
  {name:"Cleanfuel",stations:54,diesel:[104.82,7.82],premDiesel:null,unleaded91:[92.49,4.88],eGas:null,prem95:[96.51,4.88],prem97:null,kerosene:null},
  {name:"Total",stations:41,diesel:[104.54,7.82],premDiesel:[111.88,7.82],unleaded91:[94.08,4.88],eGas:null,prem95:[95.40,4.88],prem97:[103.70,4.88],kerosene:null},
  {name:"PTT",stations:22,diesel:[100.13,7.82],premDiesel:[103.51,7.82],unleaded91:[89.59,4.88],eGas:null,prem95:[90.44,4.88],prem97:null,kerosene:null}
];

const FALLBACK_LPG = [
  {name:"Regasco",price:1229},
  {name:"Solane",price:1266},
  {name:"Petron Gasul",price:1291},
  {name:"SL Gas",price:1319},
  {name:"Phoenix LPG",price:1334},
  {name:"Total Gas",price:1636}
];

const BRAND_NAMES = new Set(FALLBACK_FUEL.map(x => x.name));

function response(data, status = 200, maxAge = FRESH_TTL) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": `public, max-age=${maxAge}, s-maxage=${maxAge}`,
      "access-control-allow-origin": "*"
    }
  });
}

async function fetchText(url, timeout = 11000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const isJina = /^https:\/\/r\.jina\.ai\//i.test(url);
    const headers = {
      "user-agent": "Mozilla/5.0 (compatible; MXFuelWatch/4.4)",
      "accept": "text/plain,text/markdown,text/html,*/*",
      "cache-control": "no-cache, no-store",
      "pragma": "no-cache"
    };
    if (isJina) {
      headers["x-no-cache"] = "true";
      headers["x-cache-tolerance"] = "0";
      headers["x-timeout"] = "10";
    }
    const r = await fetch(url, {
      headers,
      signal: controller.signal,
      cf: {cacheTtl: 0, cacheEverything: false}
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally {
    clearTimeout(timer);
  }
}

function priceCell(value) {
  const s = String(value || "").replace(/\u00a0/g, " ").trim();
  if (!s || /N\/A/i.test(s)) return null;
  const m = s.match(/([0-9]+(?:\.[0-9]+)?)\s*([↑↓])?\s*([+-]?[0-9]+(?:\.[0-9]+)?)?/);
  if (!m) return null;
  let delta = m[3] ? Number(m[3]) : 0;
  if (m[2] === "↓" && delta > 0) delta = -delta;
  return [Number(m[1]), Number.isFinite(delta) ? delta : 0];
}

function comparisonSection(text) {
  const src = String(text || "");
  const after = src.split(/##\s*Price Comparison/i)[1];
  if (!after) return src;
  return after.split(/(?:Price History|##\s*Fuel Price Map)/i)[0] || after;
}

function parseFuel(text) {
  const section = comparisonSection(text);
  const rows = [];
  const seen = new Set();
  for (const line of section.split(/\r?\n/)) {
    if (!line.includes("|")) continue;
    const p = line.split("|")
      .map(x => x.trim())
      .filter((x, i, a) => !(i === 0 && x === "") && !(i === a.length - 1 && x === ""));
    if (p.length < 9 || !BRAND_NAMES.has(p[0])) continue;
    const stations = Number.parseInt(String(p[1]).replace(/,/g, ""), 10);
    if (!Number.isFinite(stations) || stations <= 0 || seen.has(p[0])) continue;
    seen.add(p[0]);
    rows.push({
      name: p[0], stations,
      diesel: priceCell(p[2]), premDiesel: priceCell(p[3]),
      unleaded91: priceCell(p[4]), eGas: priceCell(p[5]),
      prem95: priceCell(p[6]), prem97: priceCell(p[7]), kerosene: priceCell(p[8])
    });
  }
  return rows.length >= 8 ? rows : [];
}

function parseWeeklySnapshot(text) {
  const src = String(text || "");
  const marker = src.search(/Metro Manila diesel and unleaded prices by brand/i);
  if (marker < 0) return [];
  const section = src.slice(marker, marker + 7000);
  const out = [];
  const seen = new Set();
  for (const line of section.split(/\r?\n/)) {
    if (!line.includes("|")) continue;
    const p = line.split("|").map(x => x.trim())
      .filter((x, i, a) => !(i === 0 && x === "") && !(i === a.length - 1 && x === ""));
    if (p.length < 3 || !BRAND_NAMES.has(p[0]) || seen.has(p[0])) continue;
    const diesel = Number(String(p[1]).replace(/[^0-9.]/g, ""));
    const unleaded = Number(String(p[2]).replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(diesel) || !Number.isFinite(unleaded) || diesel < 20 || unleaded < 20) continue;
    seen.add(p[0]);
    out.push({name:p[0], diesel, unleaded});
  }
  return out.length >= 8 ? out : [];
}

function fillMissingFromWeeklySnapshot(baseRows, snapshotRows) {
  if (!Array.isArray(snapshotRows) || snapshotRows.length < 8) return baseRows;
  const map = new Map(snapshotRows.map(x => [x.name, x]));
  return baseRows.map(row => {
    const s = map.get(row.name);
    if (!s) return row;
    const out = {...row};
    if (!Array.isArray(out.diesel) && Number.isFinite(s.diesel)) out.diesel = [s.diesel, 0];
    if (!Array.isArray(out.unleaded91) && Number.isFinite(s.unleaded)) out.unleaded91 = [s.unleaded, 0];
    return out;
  });
}

function parseLpgLive(text) {
  const src = String(text || "");
  const section = (src.split(/##\s*Gasul\s*\/\s*LPG Prices/i)[1] || src)
    .split(/##\s*How We Track Prices/i)[0] || "";
  const out = [];
  for (const x of FALLBACK_LPG) {
    const esc = x.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`(?:^|\\n)\\s*${esc}\\s*\\n\\s*(?:PHP|₱)\\s*([0-9,]+)`, "i"),
      new RegExp(`(?:^|\\n)\\s*${esc}\\s*\\|\\s*(?:PHP|₱)?\\s*([0-9,]+)`, "i"),
      new RegExp(`${esc}[^0-9]{0,80}(?:PHP|₱)?\\s*([0-9]{3,5})`, "i")
    ];
    let match = null;
    for (const re of patterns) { match = section.match(re); if (match) break; }
    if (match) {
      const price = Number(match[1].replace(/,/g, ""));
      if (Number.isFinite(price) && price > 100 && price < 10000) out.push({name:x.name, price});
    }
  }
  return out;
}

function validLpgRows(rows) {
  if (!Array.isArray(rows) || rows.length !== FALLBACK_LPG.length) return false;
  const expected = new Set(FALLBACK_LPG.map(x => x.name));
  for (const row of rows) {
    if (!row || !expected.has(row.name)) return false;
    const p = Number(row.price);
    if (!Number.isFinite(p) || p < 300 || p > 10000) return false;
  }
  return true;
}

function mergeLpg(live, previous) {
  const baseRows = Array.isArray(previous) && previous.length ? previous : FALLBACK_LPG;
  const map = new Map(baseRows.map(x => [x.name, {name:x.name, price:Number(x.price)}]));
  for (const x of live || []) if (Number.isFinite(Number(x.price))) map.set(x.name, {name:x.name, price:Number(x.price)});
  return FALLBACK_LPG.map(x => map.get(x.name) || x);
}

function parseUpdated(text) {
  const src = String(text || "");
  const m = src.match(/Prices updated\s+([^\n]+)/i)
    || src.match(/As of\s+([A-Z][a-z]+\s+\d{1,2},\s+20\d{2})/i)
    || src.match(/week of\s+([A-Z][a-z]+\s+\d{1,2}\s*[–-]\s*\d{1,2},\s*20\d{2})/i);
  return m ? m[1].trim() : "Latest source data";
}

function updatedEpoch(label) {
  const s = String(label || "");
  const direct = Date.parse(s);
  if (Number.isFinite(direct)) return direct;
  const m = s.match(/([A-Z][a-z]+)\s+(\d{1,2})(?:\s*[–-]\s*\d{1,2})?,\s*(20\d{2})/i);
  if (!m) return 0;
  const d = Date.parse(`${m[1]} ${m[2]}, ${m[3]}`);
  return Number.isFinite(d) ? d : 0;
}

function compareCandidates(a, b) {
  const dateDiff = updatedEpoch(b.updated) - updatedEpoch(a.updated);
  if (dateDiff) return dateDiff;
  const fuelDiff = b.fuel.length - a.fuel.length;
  if (fuelDiff) return fuelDiff;
  return b.lpg.length - a.lpg.length;
}

async function sourceCandidates() {
  const stamp = Date.now();
  const urls = [
    `${SOURCE}?mx_fresh=${stamp}`,
    `https://r.jina.ai/https://gaswatchph.com/?mx_fresh=${stamp}`,
    `https://r.jina.ai/http://gaswatchph.com/?mx_fresh=${stamp}`,
    `https://r.jina.ai/https://gaswatchph.com/`
  ];
  const settled = await Promise.allSettled(urls.map(u => fetchText(u)));
  const candidates = [];
  for (let i = 0; i < settled.length; i++) {
    const r = settled[i];
    if (r.status !== "fulfilled" || !r.value || r.value.length < 800) continue;
    const detailed = parseFuel(r.value);
    if (detailed.length < 8) continue;
    const snapshot = parseWeeklySnapshot(r.value);
    const fuel = fillMissingFromWeeklySnapshot(detailed, snapshot);
    const lpg = parseLpgLive(r.value);
    const updated = parseUpdated(r.value);
    candidates.push({url:urls[i], fuel, snapshot, lpg, updated});
  }
  candidates.sort(compareCandidates);
  return candidates;
}

async function renderedSnapshot(origin) {
  try {
    const r = await fetch(`${origin}/data/gaswatch-live.json?mx_fresh=${Date.now()}`, {
      headers: {"cache-control":"no-cache, no-store", "pragma":"no-cache"},
      cf: {cacheTtl: 0, cacheEverything: false}
    });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j || !Array.isArray(j.fuel) || j.fuel.length < 8) return null;
    return j;
  } catch (_) {
    return null;
  }
}

async function renderedLpgSnapshot(origin) {
  try {
    const r = await fetch(`${origin}/data/gaswatch-lpg.json?mx_fresh=${Date.now()}`, {
      headers: {"cache-control":"no-cache, no-store", "pragma":"no-cache"},
      cf: {cacheTtl: 0, cacheEverything: false}
    });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j || Number(j.tank_kg) !== 11 || !validLpgRows(j.lpg)) return null;
    return j;
  } catch (_) {
    return null;
  }
}

async function readJsonResponse(r) {
  try { return await r.clone().json(); } catch (_) { return null; }
}

async function buildLiveData(previousLpg, previousUpdated, origin) {
  const [candidates, rendered, renderedLpg] = await Promise.all([
    sourceCandidates(),
    renderedSnapshot(origin),
    renderedLpgSnapshot(origin)
  ]);
  const newest = candidates[0] || null;
  if (!newest && !rendered) throw new Error("GasWatch live data unavailable");

  const newestEpoch = newest ? updatedEpoch(newest.updated) : 0;
  const renderedEpoch = rendered ? updatedEpoch(rendered.updated) : 0;
  const useRendered = !!rendered && (!newest || renderedEpoch >= newestEpoch);
  const chosenUpdated = useRendered ? rendered.updated : newest.updated;
  const chosenEpoch = updatedEpoch(chosenUpdated);
  const previousEpoch = updatedEpoch(previousUpdated);
  if (previousEpoch && chosenEpoch && chosenEpoch < previousEpoch) {
    throw new Error(`Source render is older (${chosenUpdated}) than last verified (${previousUpdated})`);
  }

  let liveLpg = [];
  let lpgRendered = false;
  let lpgRenderedAt = "";

  if (renderedLpg && validLpgRows(renderedLpg.lpg)) {
    liveLpg = renderedLpg.lpg;
    lpgRendered = true;
    lpgRenderedAt = renderedLpg.rendered_at || "";
  } else {
    liveLpg = newest ? newest.lpg : [];
    if (newest && liveLpg.length < 4) {
      const withLpg = candidates.find(x => x.lpg.length >= 4 && updatedEpoch(x.updated) >= newestEpoch);
      if (withLpg) liveLpg = withLpg.lpg;
    }
  }

  return {
    fuel: useRendered ? rendered.fuel : newest.fuel,
    rendered_live: useRendered,
    rendered_at: useRendered ? (rendered.rendered_at || "") : "",
    snapshot_available: newest ? newest.snapshot.length >= 8 : false,
    snapshot_count: newest ? newest.snapshot.length : 0,
    lpg: mergeLpg(liveLpg, previousLpg),
    lpg_live: lpgRendered ? true : liveLpg.length >= 4,
    lpg_live_count: liveLpg.length,
    lpg_rendered: lpgRendered,
    lpg_rendered_at: lpgRenderedAt,
    updated: chosenUpdated,
    source_url: useRendered ? `${origin}/data/gaswatch-live.json` : newest.url,
    lpg_source_url: lpgRendered ? `${origin}/data/gaswatch-lpg.json` : (newest ? newest.url : SOURCE),
    partial: lpgRendered ? false : liveLpg.length < 4
  };
}

export async function onRequestGet(context) {
  const u = new URL(context.request.url);
  const force = u.searchParams.get("force") === "1";
  const cache = caches.default;

  // v8 invalidates pre-daily-LPG snapshots.
  const freshKey = new Request(`${u.origin}/api/fuel-cache-v8`);
  const lkgKey = new Request(`${u.origin}/api/fuel-last-good-v8`);

  if (!force) {
    const hit = await cache.match(freshKey);
    if (hit) return hit;
  }

  let previousLpg = FALLBACK_LPG;
  let previousUpdated = "September 22, 2026";
  const previous = await cache.match(lkgKey);
  if (previous) {
    const pj = await readJsonResponse(previous);
    if (pj && Array.isArray(pj.lpg) && pj.lpg.length) previousLpg = pj.lpg;
    if (pj && pj.updated) previousUpdated = pj.updated;
  }

  try {
    const live = await buildLiveData(previousLpg, previousUpdated, u.origin);
    const data = {
      ok: true,
      fallback: false,
      stale: false,
      partial: !!live.partial,
      rendered_live: !!live.rendered_live,
      rendered_at: live.rendered_at,
      snapshot_available: !!live.snapshot_available,
      snapshot_count: live.snapshot_count || 0,
      lpg_live: !!live.lpg_live,
      lpg_stale: !live.lpg_live,
      lpg_live_count: live.lpg_live_count || 0,
      lpg_rendered: !!live.lpg_rendered,
      lpg_rendered_at: live.lpg_rendered_at,
      source: "GasWatch PH",
      source_url: SOURCE,
      transport: live.source_url,
      lpg_transport: live.lpg_source_url,
      updated: live.updated,
      checked_at: new Date().toISOString(),
      fuel: live.fuel,
      lpg: live.lpg,
      note: live.rendered_live
        ? "Browser-rendered GasWatch fuel table loaded. LPG uses the daily browser-rendered snapshot when available."
        : "Direct GasWatch fuel table used as fallback. LPG uses the daily browser-rendered snapshot when available."
    };
    const fresh = response(data, 200, FRESH_TTL);
    const keep = response(data, 200, LAST_GOOD_TTL);
    context.waitUntil(Promise.all([
      cache.put(freshKey, fresh.clone()),
      cache.put(lkgKey, keep.clone())
    ]));
    return fresh;
  } catch (e) {
    const last = await cache.match(lkgKey);
    if (last) {
      const j = await readJsonResponse(last);
      if (j && Array.isArray(j.fuel) && j.fuel.length >= 8) {
        return response({...j, ok:true, fallback:true, stale:true, checked_at:new Date().toISOString(),
          note:"Live source temporarily unavailable — last verified prices kept automatically.", error:String(e)}, 200, 30);
      }
    }
    return response({
      ok:true, fallback:true, stale:true, partial:true, rendered_live:false,
      lpg_rendered:false,
      source:"GasWatch PH", source_url:SOURCE, updated:"September 22, 2026",
      checked_at:new Date().toISOString(), fuel:FALLBACK_FUEL, lpg:FALLBACK_LPG,
      note:"Live source unavailable and no verified cache exists yet; latest verified snapshot shown.",
      error:String(e)
    }, 200, 30);
  }
}
