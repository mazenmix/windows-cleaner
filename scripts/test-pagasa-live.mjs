import fs from 'node:fs';
import assert from 'node:assert/strict';
const text=fs.readFileSync('functions/api/pagasa-live.js','utf8');
const api=await import('data:text/javascript;base64,'+Buffer.from(text).toString('base64'));
const {parseCyclone,parseThreat,parseFlood,issuedISO}=api.__test;
const t=Date.parse('2026-10-22T10:00:00Z');
const storm='<html><head><title>PAGASA</title></head><body><nav>Tropical Cyclone Bulletin Active</nav><main>'+
 '<h3>Tropical Cyclone Bulletin #10</h3><h4>Typhoon "Rosal"</h4><h5>Issued at 05:00 pm, 22 October 2026</h5>'+
 '<p>ROSAL WEAKENS INTO A TYPHOON OVER THE PHILIPPINE SEA EAST OF BATANES.</p>'+
 '<div>Location of Eye/center The center of the eye of Typhoon ROSAL was estimated based on all available data at 350 km East of Itbayat, Batanes (20.9 °N, 125.2 °E )</div>'+
 '<div>Movement Moving Northwestward at 15 km/h</div><div>Strength Maximum sustained winds of 165 km/h near the center and gustiness of up to 205 km/h</div>'+
 '</main></body></html>';
const live=parseCyclone(storm,t);
assert.equal(live.state,'active',JSON.stringify(live));
assert.equal(live.active,true);
assert.equal(live.name,'ROSAL');
assert.equal(live.category,'Typhoon');
assert.equal(live.bulletin_no,10);
assert.equal(live.wind_kmh,165);
assert.equal(live.gust_kmh,205);
assert.match(live.movement,/Northwestward/);
assert.equal(issuedISO(storm),'2026-10-22T09:00:00.000Z');
const old=parseCyclone(storm,t+24*3600000);
assert.equal(old.state,'stale');
assert.equal(old.active,true);
const clear=parseCyclone('<h2>Tropical Cyclone Bulletin</h2><h3>No Active Tropical Cyclone within the Philippine Area of Responsibility</h3>',t);
assert.equal(clear.state,'clear');
assert.equal(clear.active,false);
const unknown=parseCyclone('<nav>Tropical Cyclone Bulletin Active</nav><p>Welcome to PAGASA</p>',t);
assert.equal(unknown.state,'unavailable');
assert.equal(unknown.active,null);
const advisory=parseCyclone('<h3>No Active Tropical Cyclone outside the Philippine Area of Responsibility</h3>',t);
assert.equal(advisory.state,'unavailable','Outside-PAR clearance must not clear inside-PAR warning');
const threat=parseThreat('<main><h3>TC-Threat Potential Forecast</h3><p>Date : October 15, 2026 - October 28, 2026</p></main>');
assert.equal(threat.state,'available');
assert.match(threat.period,/October 15/);
const flood=parseFlood('<main><h2>Flood Information</h2><p>Pampanga Flood Advisory</p></main>');
assert.equal(flood.state,'active');
const unknownFlood=parseFlood('<nav>Flood Information</nav><p>Welcome to PAGASA flood service. Check the local bulletins here.</p>');
assert.equal(unknownFlood.state,'unverified');
console.log('PASS PAGASA live: active Rosal, cleared, unavailable, outdated, flood and outlook.');


const at=new Date();
const ph=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Manila',day:'numeric',month:'long',year:'numeric',hour:'numeric',minute:'2-digit',hour12:true}).formatToParts(at);
const part=(k)=>ph.find(x=>x.type===k)?.value;
const issued='Issued at '+part('hour')+':'+part('minute')+' '+part('dayPeriod').toLowerCase()+', '+part('day')+' '+part('month')+' '+part('year');
const activeHTML='<main><h2>Tropical Cyclone Bulletin #12</h2><h3>Typhoon "Rosal"</h3><h4>'+issued+'</h4><p>ROSAL IS ACTIVE OVER THE SEA EAST OF BATANES. Maximum sustained winds of 155 km/h near the center.</p></main>'.padEnd(360,' ');
const navOnly='<html><body><nav>Latest PAGASA services and advisories</nav><p>Official bulletin page moved.</p></body></html>'.padEnd(360,' ');
const recentMedia='<rss version="2.0"><channel><item><title>Typhoon Rosal prompts PAGASA warning for Batanes in the Philippines</title><pubDate>'+at.toUTCString()+'</pubDate><source>Philstar.com</source></item></channel></rss>';
globalThis.caches={default:{async match(){return null},async put(){}}};
const ctx={request:new Request('https://mxfuel.pages.dev/api/pagasa-live'),waitUntil(p){Promise.resolve(p).catch(()=>{})}};
let detailAccess=0;
globalThis.fetch=async url=>{
 const target=String(url);
 if(target.includes('severe-weather-bulletin/1')){detailAccess++;return new Response(activeHTML,{status:200})}
 if(target.includes('severe-weather-bulletin'))return new Response(navOnly,{status:200});
 if(target.includes('news.google.com'))return new Response(recentMedia,{status:200});
 return new Response('<html>Flood Information TC-Threat Potential Forecast Latest weather bulletins</html>'.padEnd(350,' '),{status:200});
};
let endpoint=await api.onRequestGet(ctx);
let check=await endpoint.json();
assert.equal(endpoint.status,200);
assert.ok(detailAccess>0,'The official /1 bulletin must be checked when main page contains only navigation');
assert.equal(check.cyclone.state,'active',JSON.stringify(check.cyclone));
assert.equal(check.cyclone.name,'ROSAL');
detailAccess=0;
globalThis.fetch=async url=>{
 const target=String(url);
 if(target.includes('severe-weather-bulletin'))return new Response(navOnly,{status:200});
 if(target.includes('news.google.com'))return new Response(recentMedia,{status:200});
 return new Response('<html>Flood Information TC-Threat Potential Forecast Latest weather bulletins</html>'.padEnd(350,' '),{status:200});
};
endpoint=await api.onRequestGet(ctx);
check=await endpoint.json();
assert.equal(check.cyclone.state,'reported','Recent media must be visible when PAGASA is unreachable');
assert.equal(check.cyclone.active,null,'Recent media must never masquerade as PAGASA confirmation');
assert.equal(check.cyclone.name,'ROSAL');
console.log('PASS live alternate official bulletin and clearly labeled media fallback.');
