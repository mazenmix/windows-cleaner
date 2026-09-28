const MX_BUILD = "2026-09-28-readability-v1";

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const response = await context.next();
  const headers = new Headers(response.headers);

  // Always expose the deployed build and prevent browsers/CDNs from pinning
  // an old HTML shell or an old fuel API response after a production update.
  headers.set('x-mx-build', MX_BUILD);
  if (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/api/fuel') {
    headers.set('cache-control', 'no-store, no-cache, must-revalidate, max-age=0');
    headers.set('pragma', 'no-cache');
    headers.set('expires', '0');
  }

  if (url.pathname !== '/' && url.pathname !== '/index.html') {
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }

  const meta = `
<meta property="og:type" content="website">
<meta property="og:url" content="https://mxfuel.pages.dev/">
<meta property="og:title" content="Abangan ninyo! | MX Fuel">
<meta property="og:description" content="Philippines real-time prices and info for fuel, LPG, food, weather, and money exchange.">
<meta property="og:image" content="https://mxfuel.pages.dev/mxfuel-preview-600x315.jpg?v=20260926b">
<meta property="og:image:secure_url" content="https://mxfuel.pages.dev/mxfuel-preview-600x315.jpg?v=20260926b">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="600">
<meta property="og:image:height" content="315">
<meta property="og:image:alt" content="Abangan ninyo! — Philippines real-time prices and info dashboard">
<meta property="og:site_name" content="MX Fuel">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Abangan ninyo! | MX Fuel">
<meta name="twitter:description" content="Philippines real-time prices and info for fuel, LPG, food, weather, and money exchange.">
<meta name="twitter:image" content="https://mxfuel.pages.dev/mxfuel-preview-600x315.jpg?v=20260926b">
<link rel="canonical" href="https://mxfuel.pages.dev/">
<meta name="mx-build" content="${MX_BUILD}">
`;

  const readability = `
<style id="mx-readability-v1">
/* MX Fuel readability pass — sized to match the clearer Weather page hierarchy */
.hero p{font-size:14.5px!important;line-height:1.6!important}
.livecopy b{font-size:15px!important}.livecopy span{font-size:11px!important;line-height:1.35!important}
.visitor-chip .visitor-label{font-size:9.5px!important}.visitor-chip b{font-size:13px!important}.visitor-estimated{font-size:7px!important;opacity:.62!important}
.weather-now-btn,.daily-cost-btn{font-size:13px!important}

.summary-card{min-height:90px!important;padding:15px 16px!important}
.summary-label{font-size:10.5px!important;letter-spacing:.7px!important}
.summary-value{font-size:25px!important;margin-top:9px!important}
.summary-brand{font-size:11.5px!important;margin-top:7px!important}

.fuel-table th{height:43px!important;font-size:11.5px!important;padding-left:15px!important;padding-right:15px!important}
.fuel-table td{height:56px!important;font-size:13.5px!important;padding:8px 15px!important}
.brandcell{font-size:13.5px!important;font-weight:800!important}.station-count{font-size:13px!important}
.price-main{font-size:17.5px!important}.delta{font-size:10.5px!important;margin-top:3px!important}
.table-foot{min-height:38px!important;height:auto!important;font-size:10.5px!important;padding:8px 14px!important}

.mobile-brand-card{padding:15px!important}.mobile-brand-name{font-size:14.5px!important}.mobile-stations{font-size:10.5px!important}
.mobile-price{padding:10px 11px!important}.mobile-price small{font-size:9.5px!important;margin-bottom:5px!important}
.mobile-price .price-main{font-size:17px!important}.mobile-price .delta{font-size:9.5px!important}

.lpg-title h2{font-size:26px!important}.lpg-title p{font-size:12.5px!important;line-height:1.5!important}
.weight{font-size:12px!important}.lpg-card{min-height:116px!important;padding:15px 16px!important}
.lpg-name{font-size:13px!important}.cheapest-badge{font-size:10px!important}.lpg-price{font-size:27px!important}.lpg-price small{font-size:11px!important}.lpg-bottom{font-size:10.5px!important}

.food-prices-head p,.fx-head p{font-size:11.5px!important;line-height:1.55!important}
.food-eyebrow,.fx-eyebrow{font-size:10px!important}.food-source-pill,.fx-status{font-size:9.5px!important}
.food-category-head{min-height:42px!important}.food-category-title{font-size:12.5px!important}.food-category-count{font-size:9.5px!important}
.food-row{min-height:52px!important;padding:9px 13px!important}.food-row-name{font-size:11.5px!important}.food-row-price{font-size:11.5px!important}.food-row-trend{font-size:8.5px!important}.food-row-change{font-size:9.5px!important}

.fx-table th{font-size:11px!important}.fx-table th small{font-size:8px!important}.fx-table td{font-size:12px!important;height:62px!important}
.fx-provider-name{font-size:12px!important}.fx-provider-note{font-size:8.5px!important}.fx-rate small{font-size:7.5px!important}.fx-rate b{font-size:11px!important}.fx-foot{font-size:9.5px!important}
.fx-mobile-head b{font-size:13px!important}.fx-mobile-status{font-size:8.5px!important}.fx-mobile-currency>strong{font-size:9.5px!important}

.footer-note{font-size:10.5px!important}

@media(max-width:600px){
 .hero p{font-size:13.5px!important}
 .summary-card{min-height:82px!important;padding:13px!important}.summary-label{font-size:9.5px!important}.summary-value{font-size:22px!important}.summary-brand{font-size:10.5px!important}
 .mobile-brand-name{font-size:14px!important}.mobile-stations{font-size:10px!important}.mobile-price small{font-size:9px!important}.mobile-price .price-main{font-size:16.5px!important}.mobile-price .delta{font-size:9px!important}
 .lpg-title h2{font-size:23px!important}.lpg-title p{font-size:11.5px!important}.lpg-name{font-size:12.5px!important}.lpg-price{font-size:25px!important}.lpg-bottom{font-size:10px!important}
 .food-prices-head p,.fx-head p{font-size:11px!important}.food-category-title{font-size:12px!important}.food-row-name,.food-row-price{font-size:11px!important}
 .visitor-chip .visitor-label{font-size:9px!important}.visitor-chip b{font-size:12.5px!important}
}
</style>
`;

  const rewritten = new HTMLRewriter()
    .on('head', {
      element(element) {
        element.append(meta + readability, { html: true });
      },
    })
    .transform(response);

  const outHeaders = new Headers(rewritten.headers);
  for (const [k, v] of headers.entries()) outHeaders.set(k, v);

  return new Response(rewritten.body, {
    status: rewritten.status,
    statusText: rewritten.statusText,
    headers: outHeaders
  });
}
