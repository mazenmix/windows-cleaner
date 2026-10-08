// Celebrity article image metadata. Returns the original publisher's Open Graph image URL.
// Images are displayed from publishers; this endpoint does not copy or claim image ownership.
const DOMAINS=["philstar.com","pep.ph","gmanetwork.com","abs-cbn.com","rappler.com","inquirer.net","mb.com.ph","manilabulletin.com.ph","manilatimes.net","variety.com","deadline.com","billboard.com","people.com","hollywoodreporter.com","apnews.com"];
function allowed(host){const h=String(host||"").toLowerCase();return DOMAINS.some(d=>h===d||h.endsWith("."+d))}
function j(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","access-control-allow-origin":"*","cache-control":"public, max-age=1800, s-maxage=21600"}})}
function decode(s){return String(s||"").replace(/&amp;/gi,"&").replace(/&#39;|&apos;/gi,"'").replace(/&quot;/gi,'"').replace(/&lt;/gi,"<").replace(/&gt;/gi,">")}
function imageFromHtml(raw,article){
 const html=String(raw||"");
 const metas=html.match(/<meta\b[^>]*>/gi)||[];
 for(const name of ["og:image","og:image:url","og:image:secure_url","twitter:image","twitter:image:src"]){
  for(const meta of metas){
   if(!new RegExp("(?:property|name)\\s*=\\s*[\"']"+name.replace(":","\\:")+"[\"']","i").test(meta))continue;
   const match=meta.match(/content\s*=\s*["']([^"']+)["']/i);
   if(!match)continue;
   try{
    const src=new URL(decode(match[1]).trim(),article);
    if(src.protocol==="https:"||src.protocol==="http:")return src.href;
   }catch(_){}
  }
 }
 const fallback=html.match(/https?:\/\/media\.philstar\.com\/photos\/[^\s"'<>]+?\.(?:jpg|jpeg|png|webp)/i);
 return fallback?decode(fallback[0]):"";
}
export async function onRequestGet(ctx){
 const url=new URL(ctx.request.url);
 let article=url.searchParams.get("url")||"";
 const ref=url.searchParams.get("ref");
 if(ref){try{article=atob(ref.replace(/-/g,"+").replace(/_/g,"/"))}catch(_){return j({ok:false,error:"invalid reference"},400)}}
 let target;
 try{target=new URL(article)}catch(_){return j({ok:false,error:"invalid article URL"},400)}
 if(target.protocol!=="https:"||!allowed(target.hostname))return j({ok:false,error:"unsupported publisher"},400);
 const cache=caches.default,key=new Request(url.origin+"/api/celebrity-image-cache-v1?url="+encodeURIComponent(target.href));
 const hit=await cache.match(key);if(hit)return hit;
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),6800);
 try{
  const response=await fetch(target.href,{headers:{"user-agent":"Mozilla/5.0","accept":"text/html,application/xhtml+xml"},signal:ctrl.signal,cf:{cacheTtl:0,cacheEverything:false}});
  if(!response.ok)throw Error("Article HTTP "+response.status);
  const html=await response.text();
  const image=imageFromHtml(html,target.href);
  if(!image)throw Error("No article image");
  const result=j({ok:true,image,article:target.href});
  ctx.waitUntil(cache.put(key,result.clone()));
  return result;
 }catch(e){return j({ok:false,error:String(e)},404)}
 finally{clearTimeout(timer)}
}