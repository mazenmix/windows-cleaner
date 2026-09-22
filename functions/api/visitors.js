function j(data,status=200,headers={}){
  return new Response(JSON.stringify(data),{status,headers:{
    "content-type":"application/json; charset=utf-8",
    "cache-control":"no-store",
    ...headers
  }});
}
function cookieId(req){
  const raw=req.headers.get("cookie")||"";
  const m=raw.match(/(?:^|;\s*)mxvid=([a-zA-Z0-9_-]{12,80})/);
  return m?m[1]:null;
}
function phDay(ts=Date.now()){
  return new Date(ts+8*3600000).toISOString().slice(0,10);
}
async function countPrefix(kv,prefix,max=50000){
  let cursor=undefined,total=0;
  do{
    const r=await kv.list({prefix,limit:1000,cursor});
    total+=r.keys.length;
    cursor=r.list_complete?undefined:r.cursor;
    if(total>=max)break;
  }while(cursor);
  return total;
}
export async function onRequestGet(context){
  const kv=context.env?.VISITORS_KV;
  if(!kv)return j({ok:false,configured:false,error:"VISITORS_KV binding missing"},503);

  const req=context.request;
  let id=cookieId(req),setCookie=null;
  if(!id){
    id=crypto.randomUUID().replace(/-/g,"");
    setCookie="mxvid="+id+"; Max-Age=31536000; Path=/; SameSite=Lax; Secure";
  }

  const day=phDay();
  const activeTtl=300;
  await Promise.all([
    kv.put("day:"+day+":"+id,"1",{expirationTtl:172800}),
    kv.put("active:"+id,"1",{expirationTtl:activeTtl})
  ]);

  const [today,now]=await Promise.all([
    countPrefix(kv,"day:"+day+":"),
    countPrefix(kv,"active:")
  ]);

  return j({
    ok:true,
    configured:true,
    today,
    now,
    active_window_minutes:5,
    timezone:"Asia/Manila",
    checked_at:new Date().toISOString()
  },200,setCookie?{"set-cookie":setCookie}:{});
}
