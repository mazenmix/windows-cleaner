const MX_BUILD = "2026-09-27-fuel-v4";

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

  const rewritten = new HTMLRewriter()
    .on('head', {
      element(element) {
        element.append(meta, { html: true });
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
