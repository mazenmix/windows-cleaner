export async function onRequest(context) {
  const url = new URL(context.request.url);
  const response = await context.next();

  if (url.pathname !== '/' && url.pathname !== '/index.html') {
    return response;
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response;
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
`;

  return new HTMLRewriter()
    .on('head', {
      element(element) {
        element.append(meta, { html: true });
      },
    })
    .transform(response);
}
