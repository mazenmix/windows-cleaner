const TTL=600;
const PAGASA_TC="https://bagong.pagasa.dost.gov.ph/tropical-cyclone-bulletin-iframe";
const PAGASA_THREAT="https://www.pagasa.dost.gov.ph/tropical-cyclone/tc-threat-potential-forecast";
const PAGASA_FLOOD="https://www.pagasa.dost.gov.ph/flood";
const PAGASA_S2S="https://bagong.pagasa.dost.gov.ph/climate/climate-prediction/sub-seasonal2";

function json(data,status=200,maxAge=TTL){
 return new Response(JSON.stringify(data),{status,headers:{
  "content-type":"application/json; charset=utf-8",
  "cache-control":"public, max-age="+maxAge+", s-maxage="+maxAge,
  "access-control-allow-origin":"*"
 }});
}
async function fetchJson(url,timeout=10000,headers={}){
 const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);
 try{
  const r=await fetch(url,{headers:{"user-agent":"Mozilla/5.0 (compatible; MXWeatherNow/1.0)",accept:"application/json,*/*",...headers},signal:c.signal});
  if(!r.ok)throw new Error("HTTP "+r.status+" "+url);
  return await r.json();
 }finally{clearTimeout(t)}
}
async function fetchText(url,timeout=10000){
 const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);
 try{
  const r=await fetch(url,{headers:{"user-agent":"Mozilla/5.0 (compatible; MXWeatherNow/1.0)",accept:"text/html,text/plain,*/*"},signal:c.signal});
  if(!r.ok)throw new Error("HTTP "+r.status+" "+url);
  return await r.text();
 }finally{clearTimeout(t)}
}
async function readable(url){
 try{return await fetchText(url)}
 catch(e){return await fetchText("https://r.jina.ai/"+url,12000)}
}
function clean(s){
 return String(s||"").replace(/<script\b[\s\S]*?<\/script>/gi," ").replace(/<style\b[\s\S]*?<\/style>/gi," ")
  .replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&")
  .replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/\s+/g," ").trim();
}
function clip(s,n=600){const x=clean(s);return x.length>n?x.slice(0,n).replace(/\s+\S*$/,"")+"…":x}
function avg(arr){const a=(arr||[]).filter(Number.isFinite);return a.length?a.reduce((x,y)=>x+y,0)/a.length:null}
function max(arr){const a=(arr||[]).filter(Number.isFinite);return a.length?Math.max(...a):null}
function sum(arr){return (arr||[]).filter(Number.isFinite).reduce((x,y)=>x+y,0)}
function round(n,d=0){if(!Number.isFinite(n))return null;const p=10**d;return Math.round(n*p)/p}
function riskLevel(value,steps){
 for(const [limit,label] of steps)if(value>=limit)return label;
 return "Low";
}
function dailySeries(obj,prefix){
 if(!obj||!obj.daily)return[];
 const d=obj.daily;
 if(Array.isArray(d[prefix]))return d[prefix];
 const keys=Object.keys(d).filter(k=>k===prefix||k.startsWith(prefix+"_member"));
 if(!keys.length)return[];
 const len=Math.max(...keys.map(k=>Array.isArray(d[k])?d[k].length:0));
 const out=[];
 for(let i=0;i<len;i++){
  const vals=keys.map(k=>Number(d[k]?.[i])).filter(Number.isFinite);
  out.push(vals.length?avg(vals):null);
 }
 return out;
}
function groupOutlook(seasonal){
 if(!seasonal||!seasonal.daily||!Array.isArray(seasonal.daily.time))return[];
 const dates=seasonal.daily.time;
 const temp=dailySeries(seasonal,"temperature_2m_mean");
 const tmax=dailySeries(seasonal,"temperature_2m_max");
 const tmin=dailySeries(seasonal,"temperature_2m_min");
 const rain=dailySeries(seasonal,"precipitation_sum");
 const wind=dailySeries(seasonal,"wind_speed_10m_max");
 const groups=[];
 for(let s=0;s<Math.min(dates.length,46);s+=7){
  const e=Math.min(s+7,dates.length);
  groups.push({
   start:dates[s],end:dates[e-1],
   temp_mean:round(avg(temp.slice(s,e)),1),
   temp_max:round(avg(tmax.slice(s,e)),1),
   temp_min:round(avg(tmin.slice(s,e)),1),
   rain_total:round(sum(rain.slice(s,e)),1),
   wind_max:round(max(wind.slice(s,e)),0)
  });
 }
 return groups;
}
function parseCyclone(text){
 const t=clean(text);
 const none=/No Active Tropical Cyclone within the Philippine Area of Responsibility/i.test(t);
 if(none)return {active:false,status:"No active tropical cyclone within PAR",summary:"PAGASA reports no active tropical cyclone within the Philippine Area of Responsibility."};
 const lines=t.split(/(?=TROPICAL|Tropical|SEVERE|Severe|Issued|ISSUED)/).map(x=>x.trim()).filter(Boolean);
 return {active:true,status:"Active tropical cyclone / bulletin",summary:clip(lines.slice(0,4).join(" "),700)};
}
function parseThreat(text){
 const t=clean(text);
 const date=(t.match(/Date\s*:\s*([^T]{6,80}?)(?=TC-Threat|Link|For Particulars|$)/i)||[])[1];
 const formation=(t.match(/(?:low|moderate|high)[^.!?]{0,220}(?:TC formation|tropical cyclone formation)[^.!?]*[.!?]/i)||[])[0];
 return {
  period:date?clean(date):"Latest 2-week outlook",
  summary:formation?clip(formation,520):clip(t.match(/TC-Threat Potential Forecast[\s\S]{0,700}/i)?.[0]||t,520)
 };
}
function parseFlood(text){
 const t=clean(text);
 const statuses=[];
 const re=/(Pampanga|Agno|Bicol|Cagayan|NCR\/Pasig Marikina Laguna de Bay|Abra|Cagayan De Oro|Ilog-Hilabangan|Jalaur|Panay|Tagum-Libuganon|Apayao-Abulug|Agusan|Agus|Buayan-Malungon|Davao|Mindanao|Tagoloan|Angat Sub-basin)\s+(Non-Flood Watch|Flood Outlook|Flood Advisory|Flood Warning|Critical Flood Warning)/gi;
 let m;while((m=re.exec(t)))statuses.push({basin:m[1],status:m[2]});
 const active=statuses.filter(x=>!/Non-Flood Watch/i.test(x.status));
 return {active_count:active.length,active,statuses:statuses.slice(0,25),summary:active.length?active.map(x=>x.basin+": "+x.status).join(" • "):"No active flood watch found among PAGASA major river basins."};
}
function parseS2S(text){
 const t=clean(text);
 const out=[];
 const re=/Probability of receiving ([^.]{20,420})\./gi;
 let m;while((m=re.exec(t))&&out.length<6){const s="Probability of receiving "+clean(m[1])+".";if(!out.includes(s))out.push(s)}
 const current=(t.match(/Initial Condition:\s*([A-Za-z]+\s+\d{1,2},\s*20\d{2})/i)||[])[1]||"Latest PAGASA run";
 return {initial_condition:current,summaries:out};
}
function localRisks(f){
 const h=f?.hourly||{},d=f?.daily||{};
 const now=Date.now(),times=(h.time||[]).map(x=>Date.parse(x));
 const idx=times.findIndex(t=>t>=now-3600000); const s=idx<0?0:idx;
 const p24=(h.precipitation||[]).slice(s,s+24), p72=(h.precipitation||[]).slice(s,s+72);
 const prob24=(h.precipitation_probability||[]).slice(s,s+24);
 const gust24=(h.wind_gusts_10m||[]).slice(s,s+24);
 const cape24=(h.cape||[]).slice(s,s+24);
 const rain24=sum(p24),rain72=sum(p72),maxProb=max(prob24)||0,maxGust=max(gust24)||0,maxCape=max(cape24)||0;
 const rainScore=Math.max(maxProb,Math.min(100,rain24*2.1));
 const floodScore=Math.min(100,(rain24*1.1)+(rain72*.45)+(maxProb*.18));
 const stormScore=Math.min(100,(maxGust*.65)+(Math.min(maxCape,2000)/35)+(maxProb*.2));
 const heat=Math.max(...(d.apparent_temperature_max||[]).slice(0,3).filter(Number.isFinite),0);
 return {
  rain:{score:round(rainScore),level:riskLevel(rainScore,[[75,"Very High"],[55,"High"],[30,"Moderate"]]),next24_mm:round(rain24,1),probability_max:round(maxProb)},
  flood:{score:round(floodScore),level:riskLevel(floodScore,[[78,"Very High"],[58,"High"],[35,"Moderate"]]),next72_mm:round(rain72,1),note:"Model-based local potential; official PAGASA flood warnings take priority."},
  severe:{score:round(stormScore),level:riskLevel(stormScore,[[75,"Very High"],[55,"High"],[30,"Moderate"]]),gust_max:round(maxGust),cape_max:round(maxCape)},
  heat:{value:round(heat,1),level:heat>=42?"Danger":heat>=36?"High":heat>=32?"Moderate":"Low"},
  uv:{value:round(max((d.uv_index_max||[]).slice(0,3))||0,1)}
 };
}
async function searchPlaces(q){
 const u="https://geocoding-api.open-meteo.com/v1/search?name="+encodeURIComponent(q)+"&count=20&language=en&format=json&countryCode=PH";
 const j=await fetchJson(u,8000);
 return (j.results||[]).filter(x=>x.country_code==="PH").slice(0,12).map(x=>({
  id:x.id,name:x.name,admin1:x.admin1||"",admin2:x.admin2||"",latitude:x.latitude,longitude:x.longitude,elevation:x.elevation||null,timezone:x.timezone||"Asia/Manila"
 }));
}
async function accuweather(context,lat,lon){
 const key=context.env?.ACCUWEATHER_API_KEY;
 if(!key)return {enabled:false,reason:"API key not configured"};
 try{
  const headers={Authorization:"Bearer "+key,"Accept-Encoding":"gzip"};
  const loc=await fetchJson("https://dataservice.accuweather.com/locations/v1/cities/geoposition/search?q="+lat+","+lon,7000,headers);
  if(!loc?.Key)return {enabled:false,reason:"No AccuWeather location key"};
  const cur=await fetchJson("https://dataservice.accuweather.com/currentconditions/v1/"+encodeURIComponent(loc.Key)+"?details=true",7000,headers);
  const c=Array.isArray(cur)?cur[0]:null;
  return {enabled:true,location_key:loc.Key,location:loc.LocalizedName||loc.EnglishName||"",weather_text:c?.WeatherText||"",temperature_c:c?.Temperature?.Metric?.Value??null,realfeel_c:c?.RealFeelTemperature?.Metric?.Value??null,humidity:c?.RelativeHumidity??null,wind_kmh:c?.Wind?.Speed?.Metric?.Value??null,link:c?.Link||null,observed_at:c?.LocalObservationDateTime||null};
 }catch(e){return {enabled:false,reason:String(e)}}
}
async function weatherData(context,lat,lon,name){
 const base="latitude="+encodeURIComponent(lat)+"&longitude="+encodeURIComponent(lon)+"&timezone=Asia%2FManila";
 const forecastUrl="https://api.open-meteo.com/v1/forecast?"+base+
 "&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,weather_code,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m"+
 "&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,precipitation_probability,precipitation,rain,showers,weather_code,cloud_cover,visibility,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cape"+
 "&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,uv_index_max,precipitation_sum,rain_sum,showers_sum,precipitation_hours,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant"+
 "&forecast_days=16";
 const seasonalUrl="https://seasonal-api.open-meteo.com/v1/seasonal?"+base+
 "&daily=temperature_2m_mean,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&forecast_days=46";
 const [forecastR,seasonR,tcR,threatR,floodR,s2sR,accuR]=await Promise.allSettled([
  fetchJson(forecastUrl,11000),
  fetchJson(seasonalUrl,14000),
  readable(PAGASA_TC),
  readable(PAGASA_THREAT),
  readable(PAGASA_FLOOD),
  readable(PAGASA_S2S),
  accuweather(context,lat,lon)
 ]);
 if(forecastR.status!=="fulfilled")throw forecastR.reason;
 const forecast=forecastR.value;
 return {
  ok:true,location:{name:name||"Selected Area",latitude:Number(lat),longitude:Number(lon),timezone:"Asia/Manila"},
  checked_at:new Date().toISOString(),
  forecast,
  outlook46:seasonR.status==="fulfilled"?groupOutlook(seasonR.value):[],
  risks:localRisks(forecast),
  pagasa:{
   cyclone:tcR.status==="fulfilled"?parseCyclone(tcR.value):{active:null,status:"PAGASA unavailable",summary:"Unable to fetch cyclone bulletin."},
   threat:threatR.status==="fulfilled"?parseThreat(threatR.value):{period:"Unavailable",summary:"Unable to fetch PAGASA 2-week TC threat outlook."},
   flood:floodR.status==="fulfilled"?parseFlood(floodR.value):{active_count:null,active:[],statuses:[],summary:"Unable to fetch PAGASA flood status."},
   s2s:s2sR.status==="fulfilled"?parseS2S(s2sR.value):{initial_condition:"Unavailable",summaries:[]}
  },
  accuweather:accuR.status==="fulfilled"?accuR.value:{enabled:false,reason:"Unavailable"},
  sources:[
   {name:"PAGASA",role:"Official PH cyclone, flood and S2S guidance",url:"https://www.pagasa.dost.gov.ph/"},
   {name:"ECMWF EC46 / SEAS5",role:"30–46 day ensemble outlook",url:"https://www.ecmwf.int/"},
   {name:"Open-Meteo",role:"Best-match multi-model live forecast",url:"https://open-meteo.com/"},
   {name:"NOAA / NCEP GEFS",role:"Supports PAGASA TC-threat and subseasonal guidance",url:"https://www.ncep.noaa.gov/"},
   {name:"AccuWeather",role:"Optional cross-check when API key is configured",url:"https://www.accuweather.com/"}
  ]
 };
}

export async function onRequestGet(context){
 const u=new URL(context.request.url),mode=u.searchParams.get("mode")||"data";
 if(mode==="search"){
  const q=(u.searchParams.get("q")||"").trim();
  if(q.length<2)return json({ok:true,results:[]},200,300);
  try{return json({ok:true,results:await searchPlaces(q),checked_at:new Date().toISOString()},200,300)}
  catch(e){return json({ok:false,error:String(e),results:[]},502,60)}
 }
 const lat=Number(u.searchParams.get("lat")),lon=Number(u.searchParams.get("lon"));
 const name=(u.searchParams.get("name")||"Selected Area").slice(0,120);
 if(!Number.isFinite(lat)||!Number.isFinite(lon))return json({ok:false,error:"lat and lon are required"},400,60);

 const cache=caches.default;
 const key=new Request(u.origin+"/api/weather-cache-v2?lat="+lat.toFixed(3)+"&lon="+lon.toFixed(3)+"&name="+encodeURIComponent(name));
 if(u.searchParams.get("force")!=="1"){
  const hit=await cache.match(key);if(hit)return hit;
 }
 try{
  const data=await weatherData(context,lat,lon,name);
  const out=json(data);
  context.waitUntil(cache.put(key,out.clone()));
  return out;
 }catch(e){return json({ok:false,error:String(e),checked_at:new Date().toISOString()},502,60)}
}
