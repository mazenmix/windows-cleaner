export async function onRequest(context) {
  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('text/html')) {
    return response;
  }

  const html = await response.text();

  const sections = /(<section class="section">\s*<div class="section-head"><h2>Risk Intelligence<\/h2>[\s\S]*?<\/section>)\s*(<section class="section">\s*<div class="section-head"><h2>Typhoon & Flood Center<\/h2>[\s\S]*?<\/section>)\s*(<section class="section">\s*<div class="section-head"><h2>Next 24 Hours<\/h2>[\s\S]*?<\/section>)\s*(<section class="section">\s*<div class="section-head"><h2>16-Day Forecast<\/h2>[\s\S]*?<\/section>)\s*(<section class="section">\s*<div class="section-head"><h2>Satellites Predictions<\/h2>[\s\S]*?<\/section>)/i;

  const reordered = html.replace(
    sections,
    '$3\n\n$4\n\n$5\n\n$1\n\n$2'
  );

  const updatedHtml = reordered.replace(
    '<h2>Risk Intelligence</h2>',
    '<h2>Risk Potential</h2>'
  );

  if (updatedHtml === html) {
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
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
