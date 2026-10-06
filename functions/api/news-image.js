const ALLOWED_DOMAINS = [
  "gmanetwork.com","philstar.com","inquirer.net","abs-cbn.com","pna.gov.ph","manilabulletin.com.ph","mb.com.ph",
  "rappler.com","bworldonline.com","tv5.com.ph","onenews.ph","businessmirror.com.ph","sunstar.com.ph",
  "mindanews.com","manilatimes.net","reuters.com","apnews.com"
];
function allowedHost(host){
  const h=String(host||"").toLowerCase();
  return ALLOWED_DOMAINS.some(d=>h===d||h.endsWith("."+d));
}

function json(data,status=200){
  return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
}
function decodeHtml(s){
  return String(s||"").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim();
}
async function fetchWithTimeout(url,opts={},ms=6500){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);
  try{return await fetch(url,{...opts,signal:c.signal})}finally{clearTimeout(t)}
}
function findImage(html,base){
  const src=String(html||"");
  const patterns=[
    /<meta[^>]+(?:property|name)=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image(?::secure_url)?["']/i,
    /<meta[^>]+(?:property|name)=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']twitter:image(?::src)?["']/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i
  ];
  for(const re of patterns){
    const m=src.match(re);
    if(!m)continue;
    let u=decodeHtml(m[1]);
    try{
      if(u.startsWith("//"))u="https:"+u;
      u=new URL(u,base).href;
      if(/^https?:\/\//i.test(u))return u;
    }catch(_){}
  }
  return "";
}
export async function onRequestGet(context){
  const reqUrl=new URL(context.request.url);
  const article=reqUrl.searchParams.get("url")||"";
  let target;
  try{target=new URL(article)}catch(_){return json({ok:false,error:"bad url"},400)}
  if(target.protocol!=="https:"||!allowedHost(target.hostname))return json({ok:false,error:"host not allowed"},400);

  const cache=caches.default;
  const key=new Request(reqUrl.origin+"/api/news-image-cache?url="+encodeURIComponent(target.href));
  const hit=await cache.match(key);
  if(hit)return hit;

  try{
    const page=await fetchWithTimeout(target.href,{headers:{
      "user-agent":"Mozilla/5.0 (compatible; MXNewsImage/1.0)",
      "accept":"text/html,application/xhtml+xml"
    },cf:{cacheTtl:0,cacheEverything:false}},6500);
    if(!page.ok)throw new Error("article HTTP "+page.status);
    const html=await page.text();
    const imageUrl=findImage(html,target.href);
    if(!imageUrl)throw new Error("no article image");

    const img=await fetchWithTimeout(imageUrl,{headers:{
      "user-agent":"Mozilla/5.0",
      "accept":"image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      "referer":target.origin+"/"
    },cf:{cacheTtl:21600,cacheEverything:true}},6500);
    if(!img.ok)throw new Error("image HTTP "+img.status);
    const ct=img.headers.get("content-type")||"image/jpeg";
    if(!ct.toLowerCase().startsWith("image/"))throw new Error("not image");

    const headers=new Headers();
    headers.set("content-type",ct);
    headers.set("cache-control","public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400");
    headers.set("access-control-allow-origin","*");
    const out=new Response(img.body,{status:200,headers});
    context.waitUntil(cache.put(key,out.clone()));
    return out;
  }catch(e){
    return json({ok:false,error:String(e)},404);
  }
}
