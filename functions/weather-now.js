export async function onRequest(context) {
  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('text/html')) {
    return response;
  }

  const html = await response.text();

  const sections = /(<section class="section">\s*<div class="section-head"><h2>Risk Intelligence<\/h2>[\s\S]*?<\/section>)\s*(<section class="section">\s*<div class="section-head"><h2>Typhoon & Flood Center<\/h2>[\s\S]*?<\/section>)\s*(<section class="section">\s*<div class="section-head"><h2>Next 24 Hours<\/h2>[\s\S]*?<\/section>)\s*(<section class="section">\s*<div class="section-head"><h2>16-Day Forecast<\/h2>[\s\S]*?<\/section>)\s*(<section class="section">\s*<div class="section-head"><h2>Satellites Predictions<\/h2>[\s\S]*?<\/section>)/i;

  let updatedHtml = html.replace(
    sections,
    '$3\n\n$4\n\n$5\n\n$1\n\n$2'
  );

  updatedHtml = updatedHtml.replace(
    '<h2>Risk Intelligence</h2>',
    '<h2>Risk Potential</h2>'
  );

  updatedHtml = updatedHtml.replace(
    '<div class="section-head"><h2>Next 24 Hours</h2><span>3-hour checkpoints</span></div>',
    '<div class="section-head"><h2>Next 24 Hours</h2></div>'
  );

  const enhancementCss = `<style id="mxWeatherEnhancementStyles">
.mx-intel-grid{display:grid;grid-template-columns:1.2fr 1fr 1fr 1fr;gap:10px}.mx-intel-card{position:relative;overflow:hidden;border:1px solid #1c4d74;border-radius:16px;background:linear-gradient(145deg,#0a2945,#071a2d);padding:16px;min-height:156px;box-shadow:0 14px 34px rgba(0,0,0,.14)}.mx-intel-card:after{content:"";position:absolute;width:130px;height:130px;border-radius:50%;right:-45px;bottom:-60px;background:radial-gradient(circle,rgba(62,171,241,.13),transparent 67%);pointer-events:none}.mx-intel-kicker{font-size:8.5px;color:#8db2cd;text-transform:uppercase;letter-spacing:.75px;font-weight:900}.mx-intel-value{font-size:20px;font-weight:900;margin-top:10px;line-height:1.12}.mx-intel-sub{font-size:11.5px;color:#b7cfe1;line-height:1.6;margin-top:9px;font-weight:600}.mx-verdict{border-color:#2b7659;background:linear-gradient(145deg,#0b3a2d,#071d28)}.mx-verdict.caution{border-color:#8a6a25;background:linear-gradient(145deg,#3a2e0c,#111d28)}.mx-verdict.alert{border-color:#873942;background:linear-gradient(145deg,#39151b,#111c29)}.mx-verdict .mx-intel-value{font-size:27px;color:#69efb6}.mx-verdict.caution .mx-intel-value{color:#ffd15a}.mx-verdict.alert .mx-intel-value{color:#ff7a84}.mx-badge{display:inline-flex;margin-top:11px;border:1px solid #2a6e53;border-radius:14px;padding:6px 9px;font-size:8.5px;font-weight:900;color:#9bf0c8;background:#092d23}.mx-map-shell{overflow:hidden;border:1px solid #1b4d74;border-radius:16px;background:#061a2b}.mx-map-toolbar{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:10px;border-bottom:1px solid #173d5b}.mx-map-layer{border:1px solid #225a83;border-radius:15px;background:#08243c;color:#9fc0d8;padding:8px 12px;font-size:8.5px;font-weight:900;cursor:pointer}.mx-map-layer.active{border-color:#43a9ec;background:#0d3d62;color:#e9f7ff;box-shadow:0 0 0 2px rgba(67,169,236,.08)}.mx-map-frame{display:block;width:100%;height:430px;border:0;background:#061522}.mx-city-strip{display:flex;gap:9px;overflow-x:auto;padding-bottom:6px;scrollbar-width:thin;scrollbar-color:#1e4e73 #07192a}.mx-city{flex:0 0 150px;border:1px solid #17466b;border-radius:14px;background:linear-gradient(145deg,#09243d,#071a2c);padding:14px;cursor:pointer;transition:.15s ease}.mx-city:hover{transform:translateY(-2px);border-color:#3c8ec7}.mx-city-name{font-size:11.5px;color:#c3d9e9;font-weight:900;line-height:1.3}.mx-city-temp{font-size:24px;font-weight:900;margin-top:9px;line-height:1.1}.mx-city-state{font-size:10.5px;color:#a9c3d6;margin-top:7px;line-height:1.45;font-weight:600}.mx-city-load{opacity:.76}
.hour{flex-basis:124px;padding:13px 12px}.hour .time{font-size:10.5px;color:#9ab9cf;font-weight:800}.hour .ico{font-size:28px;margin:9px 0}.hour .t{font-size:16px}.hour .rain{font-size:9.5px;line-height:1.35;margin-top:7px}.hour .wind{font-size:9.5px;color:#93adc1;margin-top:6px;line-height:1.35}.rainbar{height:4px;margin-top:8px}
.day{padding:13px 11px}.day .date{font-size:10.5px;color:#a2bfd4;font-weight:800}.day .ico{font-size:29px;margin:8px 0}.day .hi{font-size:15px}.day .lo{font-size:11px}.day .pp{font-size:9.5px;line-height:1.4;margin-top:8px}.day .flood{font-size:9.5px;line-height:1.4;margin-top:7px;font-weight:700;color:#9ebdd3}.day .wind{font-size:9.5px;color:#93adc1;margin-top:6px;line-height:1.35}
.week{padding:14px;min-height:142px}.week label{font-size:9.5px;color:#a3bed2;font-weight:900}.week .range{font-size:10.5px;line-height:1.4;margin-top:5px}.week .weekly-temp{font-size:22px;margin-top:14px}.week .weekly-rain{font-size:10px;line-height:1.4;margin-top:8px}.week .weekly-wind{font-size:9.5px;color:#93adc1;line-height:1.4;margin-top:6px}
@media(max-width:1180px){.mx-intel-grid{grid-template-columns:1fr 1fr}}
@media(max-width:650px){.mx-intel-grid{grid-template-columns:1fr}.mx-map-frame{height:360px}.mx-intel-card{min-height:140px}.mx-intel-sub{font-size:12px}.mx-city{flex-basis:156px}.mx-city-name{font-size:12px}.mx-city-state{font-size:11px}.hour{flex-basis:132px}.hour .time,.day .date,.week .range{font-size:11px}.hour .rain,.hour .wind,.day .pp,.day .flood,.day .wind,.week .weekly-rain,.week .weekly-wind{font-size:10.5px}}
</style>`;

  const enhancementHtml = `<section class="section mx-intel-section" id="mxIntelligence">
<div class="section-head"><h2>Weather Deep-Check</h2></div>
<div class="mx-intel-grid">
<article class="mx-intel-card mx-verdict" id="mxVerdictCard"><div class="mx-intel-kicker">MX WEATHER VERDICT</div><div class="mx-intel-value" id="mxVerdict">ANALYZING</div><div class="mx-intel-sub" id="mxVerdictReason">Reading rain, heat, wind and official warning signals…</div><div class="mx-badge" id="mxVerdictBadge">LIVE MODEL</div></article>
<article class="mx-intel-card"><div class="mx-intel-kicker">BEST WINDOW TODAY</div><div class="mx-intel-value" id="mxBestWindow">—</div><div class="mx-intel-sub" id="mxBestReason">Lowest combined weather stress</div></article>
<article class="mx-intel-card"><div class="mx-intel-kicker">RAIN ETA</div><div class="mx-intel-value" id="mxRainEta">—</div><div class="mx-intel-sub" id="mxRainEtaSub">Scanning the next 24 hours</div></article>
<article class="mx-intel-card"><div class="mx-intel-kicker">STORM APPROACH</div><div class="mx-intel-value" id="mxStorm">—</div><div class="mx-intel-sub" id="mxStormSub">PAGASA + local severe-weather signal</div></article>
</div>
</section>

<section class="section" id="mxWeatherMapSection">
<div class="section-head"><h2>Real-Time Satellite Monitoring</h2></div>
<div class="mx-map-shell"><div class="mx-map-toolbar"><button class="mx-map-layer active" data-overlay="rain">RAIN</button><button class="mx-map-layer" data-overlay="wind">WIND</button><button class="mx-map-layer" data-overlay="temp">TEMPERATURE</button><button class="mx-map-layer" data-overlay="clouds">CLOUDS</button><button class="mx-map-layer" data-overlay="pressure">PRESSURE</button></div><iframe id="mxWeatherMap" class="mx-map-frame" title="Real-Time Satellite Monitoring" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>
</section>

<section class="section" id="mxCitiesSection">
<div class="section-head"><h2>Philippines Live Cities</h2></div>
<div class="mx-city-strip" id="mxCityStrip"></div>
</section>`;

  const enhancementScript = `<script id="mxWeatherEnhancementScript">
(function(){
 var LOC_KEY='mxWeatherNowLocationV1';
 var DATA_KEY='mxWeatherNowDataV1';
 var lastData=null;
 var lastLoc={name:'Metro Manila / NCR',lat:14.5995,lon:120.9842};
 var mapOverlay='rain';
 var cities=[['Manila',14.5995,120.9842],['Cebu',10.3157,123.8854],['Davao',7.1907,125.4553],['Baguio',16.4023,120.5960],['Iloilo',10.7202,122.5621],['Bacolod',10.6765,122.9509],['Boracay',11.9674,121.9248],['Cagayan de Oro',8.4542,124.6319]];
 function el(id){return document.getElementById(id)}
 function h24(s){var p=String(s||'').split('T')[1]||'';return Number(p.slice(0,2))}
 function timeLabel(s){var p=String(s||'').split('T')[1]||'';var h=Number(p.slice(0,2)),m=p.slice(3,5)||'00';if(!Number.isFinite(h))return '—';var ap=h>=12?'PM':'AM';var hh=h%12||12;return hh+':'+m+' '+ap}
 function weatherEmoji(code){code=Number(code);if(code===0)return '☀️';if(code<=2)return '🌤️';if(code===3)return '☁️';if(code===45||code===48)return '🌫️';if(code>=95)return '⛈️';if(code>=51)return '🌧️';return '🌥️'}
 function weatherWord(code){code=Number(code);if(code===0)return 'Clear';if(code<=2)return 'Partly cloudy';if(code===3)return 'Cloudy';if(code===45||code===48)return 'Fog';if(code>=95)return 'Thunderstorms';if(code>=51)return 'Rain';return 'Variable'}
 function hourlyStart(h){var times=h&&h.time||[];var now=Date.now();var i=times.findIndex(function(x){return Date.parse(x)>=now-3600000});return i<0?0:i}
 function maxRain24(d){var h=d&&d.forecast&&d.forecast.hourly||{},s=hourlyStart(h),arr=h.precipitation_probability||[];var m=0;for(var i=s;i<Math.min(s+24,arr.length);i++)m=Math.max(m,Number(arr[i])||0);return m}
 function maxWind24(d){var h=d&&d.forecast&&d.forecast.hourly||{},s=hourlyStart(h),arr=h.wind_gusts_10m||h.wind_speed_10m||[];var m=0;for(var i=s;i<Math.min(s+24,arr.length);i++)m=Math.max(m,Number(arr[i])||0);return m}
 function parseFetchLocation(raw){try{var u=new URL(raw,location.origin);return{name:u.searchParams.get('name')||lastLoc.name,lat:Number(u.searchParams.get('lat')),lon:Number(u.searchParams.get('lon'))}}catch(e){return lastLoc}}
 function mapUrl(lat,lon,overlay){return 'https://embed.windy.com/embed2.html?lat='+encodeURIComponent(lat)+'&lon='+encodeURIComponent(lon)+'&detailLat='+encodeURIComponent(lat)+'&detailLon='+encodeURIComponent(lon)+'&width=900&height=500&zoom=6&level=surface&overlay='+encodeURIComponent(overlay)+'&product=ecmwf&menu=&message=true&marker=true&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1'}
 function updateMap(){var f=el('mxWeatherMap');if(f)f.src=mapUrl(lastLoc.lat,lastLoc.lon,mapOverlay)}
 function analyzeWindows(d){
  var h=d&&d.forecast&&d.forecast.hourly||{},times=h.time||[],s=hourlyStart(h),end=Math.min(s+24,times.length),best=null,worst=null;
  for(var i=s;i<end;i++){
   var hour=h24(times[i]);if(hour<6||hour>22)continue;
   var pp=Number(h.precipitation_probability&&h.precipitation_probability[i])||0;
   var rain=Number(h.precipitation&&h.precipitation[i])||0;
   var temp=Number(h.temperature_2m&&h.temperature_2m[i])||28;
   var wind=Number((h.wind_gusts_10m&&h.wind_gusts_10m[i])||(h.wind_speed_10m&&h.wind_speed_10m[i]))||0;
   var score=100-(pp*.62)-(rain*9)-(Math.max(0,temp-30)*5)-(Math.max(0,wind-25)*1.05);
   var item={i:i,score:score,pp:pp,rain:rain,temp:temp,wind:wind,time:times[i]};
   if(!best||score>best.score)best=item;if(!worst||score<worst.score)worst=item;
  }
  return{best:best,worst:worst};
 }
 function renderIntel(d){
  var w=analyzeWindows(d),best=w.best,r=d.risks||{},tc=d.pagasa&&d.pagasa.cyclone||{},fl=d.pagasa&&d.pagasa.flood||{};
  var rain=maxRain24(d),gust=maxWind24(d),heat=Number(r.heat&&r.heat.value)||Number(d.forecast&&d.forecast.current&&d.forecast.current.apparent_temperature)||0;
  var severe=String(r.severe&&r.severe.level||''),flood=String(r.flood&&r.flood.level||'');
  var verdict='GO OUT',cls='',reason='Weather stress is relatively low in the best available window.';
  if(tc.active===true||(Number(fl.active_count)||0)>0||/critical|very high|danger/i.test(severe+' '+flood)){verdict='STAY ALERT';cls='alert';reason='Official or high-severity weather signals are active. Check PAGASA before travel.'}
  else if(rain>=70||heat>=40||gust>=45||/high|elevated/i.test(severe+' '+flood)){verdict='CAUTION';cls='caution';reason='Rain, heat or wind risk is elevated during part of the next 24 hours.'}
  var card=el('mxVerdictCard');if(card){card.className='mx-intel-card mx-verdict'+(cls?' '+cls:'')}
  if(el('mxVerdict'))el('mxVerdict').textContent=verdict;
  if(el('mxVerdictReason'))el('mxVerdictReason').textContent=reason;
  if(el('mxVerdictBadge'))el('mxVerdictBadge').textContent='RAIN '+Math.round(rain)+'% • GUST '+Math.round(gust)+' KM/H';
  if(best){var endTime=(d.forecast.hourly.time&&d.forecast.hourly.time[best.i+2])||best.time;if(el('mxBestWindow'))el('mxBestWindow').textContent=timeLabel(best.time)+' – '+timeLabel(endTime);if(el('mxBestReason'))el('mxBestReason').textContent='Best balance: rain '+Math.round(best.pp)+'% • '+Math.round(best.temp)+'°C • wind '+Math.round(best.wind)+' km/h';}
  var h=d.forecast&&d.forecast.hourly||{},s=hourlyStart(h),hit=-1;for(var i=s;i<Math.min(s+24,(h.time||[]).length);i++){var pp=Number(h.precipitation_probability&&h.precipitation_probability[i])||0;var mm=Number(h.precipitation&&h.precipitation[i])||0;if(pp>=65||mm>=0.2){hit=i;break}}
  if(hit>=0){var delta=Math.max(0,hit-s);if(el('mxRainEta'))el('mxRainEta').textContent=delta===0?'Possible now':delta===1?'~1 hour':'~'+delta+' hours';if(el('mxRainEtaSub'))el('mxRainEtaSub').textContent=timeLabel(h.time[hit])+' • '+Math.round(Number(h.precipitation_probability&&h.precipitation_probability[hit])||0)+'% probability';}else{if(el('mxRainEta'))el('mxRainEta').textContent='No strong signal';if(el('mxRainEtaSub'))el('mxRainEtaSub').textContent='No ≥65% rain signal detected in the next 24 hours';}
  if(tc.active===true){if(el('mxStorm'))el('mxStorm').textContent='ACTIVE CYCLONE';if(el('mxStormSub'))el('mxStormSub').textContent=(tc.status||'PAGASA cyclone advisory active')+' • open the official bulletin below';}
  else if(/high|critical|danger/i.test(severe)){if(el('mxStorm'))el('mxStorm').textContent='LOCAL SEVERE SIGNAL';if(el('mxStormSub'))el('mxStormSub').textContent=(r.severe&&r.severe.level||'Elevated')+' • gust potential '+Math.round(Number(r.severe&&r.severe.gust_max)||gust)+' km/h';}
  else{if(el('mxStorm'))el('mxStorm').textContent='NO ACTIVE CYCLONE';if(el('mxStormSub'))el('mxStormSub').textContent='PAGASA cyclone status is clear; local conditions can still change';}
 }
 function renderCities(){
  var box=el('mxCityStrip');if(!box)return;box.innerHTML=cities.map(function(c){return '<div class="mx-city mx-city-load" data-name="'+c[0]+'" data-lat="'+c[1]+'" data-lon="'+c[2]+'"><div class="mx-city-name">'+c[0]+'</div><div class="mx-city-temp">—</div><div class="mx-city-state">Loading live weather…</div></div>'}).join('');
  box.querySelectorAll('.mx-city').forEach(function(card){card.addEventListener('click',function(){try{localStorage.setItem(LOC_KEY,JSON.stringify({name:card.dataset.name,lat:Number(card.dataset.lat),lon:Number(card.dataset.lon)}));localStorage.removeItem(DATA_KEY)}catch(e){}location.reload()})});
  var lats=cities.map(function(c){return c[1]}).join(','),lons=cities.map(function(c){return c[2]}).join(',');
  fetch('https://api.open-meteo.com/v1/forecast?latitude='+encodeURIComponent(lats)+'&longitude='+encodeURIComponent(lons)+'&current=temperature_2m,weather_code&timezone=Asia%2FManila',{cache:'no-store'}).then(function(r){return r.json()}).then(function(j){var arr=Array.isArray(j)?j:[j];box.querySelectorAll('.mx-city').forEach(function(card,i){var x=arr[i]||{},c=x.current||{};card.classList.remove('mx-city-load');var t=card.querySelector('.mx-city-temp'),s=card.querySelector('.mx-city-state');if(t)t.textContent=weatherEmoji(c.weather_code)+' '+(Number.isFinite(Number(c.temperature_2m))?Math.round(Number(c.temperature_2m))+'°C':'—');if(s)s.textContent=weatherWord(c.weather_code)+' • tap to open'})}).catch(function(){box.querySelectorAll('.mx-city-state').forEach(function(x){x.textContent='Live city feed unavailable'})});
 }
 function renderAll(d,loc){if(!d||!d.forecast)return;lastData=d;if(loc&&Number.isFinite(loc.lat)&&Number.isFinite(loc.lon))lastLoc=loc;renderIntel(d);updateMap()}
 document.querySelectorAll('.mx-map-layer').forEach(function(b){b.addEventListener('click',function(){document.querySelectorAll('.mx-map-layer').forEach(function(x){x.classList.remove('active')});b.classList.add('active');mapOverlay=b.dataset.overlay||'rain';updateMap()})});
 renderCities();updateMap();setInterval(renderCities,900000);
 try{var cached=JSON.parse(localStorage.getItem(DATA_KEY)||'null');if(cached&&cached.data){lastLoc={name:cached.name||lastLoc.name,lat:Number(cached.lat),lon:Number(cached.lon)};renderAll(cached.data,lastLoc)}}catch(e){}
 var nativeFetch=window.fetch.bind(window);
 window.fetch=function(input,init){return nativeFetch(input,init).then(function(res){try{var raw=typeof input==='string'?input:(input&&input.url)||'';if(raw.indexOf('/api/weather?')!==-1&&raw.indexOf('mode=search')===-1){var loc=parseFetchLocation(raw);res.clone().json().then(function(j){if(j&&j.ok)renderAll(j,loc)}).catch(function(){})}}catch(e){}return res})};
})();
</script>`;

  if (!updatedHtml.includes('id="mxWeatherEnhancementStyles"')) {
    updatedHtml = updatedHtml.replace('</head>', enhancementCss + '\n</head>');
  }

  const next24Marker = '<section class="section">\n<div class="section-head"><h2>Next 24 Hours</h2>';
  if (!updatedHtml.includes('id="mxIntelligence"')) {
    updatedHtml = updatedHtml.replace(next24Marker, enhancementHtml + '\n' + enhancementScript + '\n\n' + next24Marker);
  }

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('etag');
  headers.delete('content-encoding');

  return new Response(updatedHtml, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
