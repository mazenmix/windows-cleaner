import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('functions/api/weather-news.js','utf8');
const {onRequestGet}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const timestamp=new Date(Date.now()-15*60000).toUTCString();
const xml=title=>'<rss version="2.0"><channel><item><title>'+title+'</title>'+
 '<link>https://www.gmanetwork.com/news/weather/latest</link>'+
 '<pubDate>'+timestamp+'</pubDate></item></channel></rss>';
let attempts=0;
globalThis.fetch=async (url)=>{
 attempts++;
 if(url.includes('data.gmanews.tv'))return new Response(xml('PAGASA updates typhoon rainfall and flood warnings'),{status:200});
 if(url.includes('philstar.com/rss'))return new Response(xml('Storm warnings and PAGASA weather for the Philippines'),{status:200});
 return new Response('RSS feed retired',{status:503});
};
globalThis.caches={default:{async match(){return null},async put(){}}};
const context={request:new Request('https://mxfuel.pages.dev/api/weather-news'),waitUntil(p){Promise.resolve(p).catch(()=>{})}};
const response=await onRequestGet(context);
assert.equal(response.status,200,'Direct publisher feeds should work even with failing Google aggregator');
const data=await response.json();
assert.equal(data.live,true);
assert.equal(data.ok,true);
assert.ok(data.sources_checked>=10,'Need multiple independent news publishers configured');
assert.ok(attempts>=10,'Should probe multiple RSS providers');
assert.ok(data.feeds_responded>=2);
assert.ok(data.items.some(x=>x.source==='GMA'));
assert.ok(data.items.some(x=>x.source==='PHILSTAR'));
assert.ok(!JSON.stringify(data.items).toLowerCase().includes('retired'));
console.log('PASS multiple publishers, source fallback, no retired headlines; feeds attempted:',attempts);
