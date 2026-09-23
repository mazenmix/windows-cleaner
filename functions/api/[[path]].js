const json=(data,status=200)=>new Response(JSON.stringify(data),{
  status,
  headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}
});

async function sha256(value){
  const bytes=new TextEncoder().encode(value);
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
function randomHex(bytes=24){
  const b=new Uint8Array(bytes); crypto.getRandomValues(b);
  return [...b].map(x=>x.toString(16).padStart(2,"0")).join("");
}
function adminOk(request,env){
  const supplied=request.headers.get("x-admin-key")||"";
  return !!env.ADMIN_KEY && supplied===env.ADMIN_KEY;
}
async function bodyJson(request){
  try{return await request.json()}catch{return null}
}
async function deviceAuth(request,env){
  const employeeId=(request.headers.get("x-employee-id")||"").trim().toUpperCase();
  const token=request.headers.get("x-device-token")||"";
  if(!employeeId||!token)return null;
  const row=await env.DB.prepare(
    "SELECT employee_id,name,token_hash,enabled FROM devices WHERE employee_id=?"
  ).bind(employeeId).first();
  if(!row)return null;

  const valid=(await sha256(token))===row.token_hash;
  if(!valid)return null;

  if(!row.enabled){
    await env.DB.prepare(
      "UPDATE devices SET enabled=1,updated_at=? WHERE employee_id=?"
    ).bind(Date.now(),employeeId).run();
    row.enabled=1;
  }

  return row;
}

export async function onRequest(context){
  const {request,env}=context;
  const url=new URL(request.url);
  const route=url.pathname.replace(/^\/api\/?/,"");

  try{
    if(route==="health"&&request.method==="GET"){
      return json({ok:true,service:"MX Field Tracker",now:Date.now()});
    }

    if(route==="register"&&request.method==="POST"){
      const body=await bodyJson(request);
      if(!body)return json({error:"Invalid JSON"},400);

      const name=String(body.name||"").trim().replace(/\s+/g," ").slice(0,80);
      const installId=String(body.installId||"").trim().slice(0,120);
      const device=String(body.device||"").trim().slice(0,120);
      const android=String(body.android||"").trim().slice(0,40);

      if(name.length<2||installId.length<8)
        return json({error:"Name and install ID are required"},400);

      const existing=await env.DB.prepare(
        "SELECT employee_id,enabled FROM devices WHERE install_id=?"
      ).bind(installId).first();

      if(existing){
        const token=randomHex(32);
        const hash=await sha256(token);
        await env.DB.prepare(
          "UPDATE devices SET name=?,token_hash=?,enabled=1,device=?,android=?,updated_at=? WHERE install_id=?"
        ).bind(name,hash,device,android,Date.now(),installId).run();
        return json({
          ok:true,
          employeeId:existing.employee_id,
          deviceToken:token,
          existing:true,
          restored:!existing.enabled
        });
      }

      const setting=await env.DB.prepare(
        "SELECT value FROM settings WHERE key='registration_enabled'"
      ).first();
      if(setting&&setting.value!=="1")
        return json({error:"New-device registration is currently closed"},403);

      const employeeId=("MX"+randomHex(5)).toUpperCase();
      const token=randomHex(32);
      const hash=await sha256(token);
      const now=Date.now();

      await env.DB.prepare(
        "INSERT INTO devices(employee_id,name,install_id,token_hash,enabled,device,android,created_at,updated_at) VALUES(?,?,?,?,1,?,?,?,?)"
      ).bind(employeeId,name,installId,hash,device,android,now,now).run();

      return json({ok:true,employeeId,deviceToken:token,existing:false});
    }

    if(route==="track"&&request.method==="POST"){
      const auth=await deviceAuth(request,env);
      if(!auth)return json({error:"Unauthorized device"},401);
      const body=await bodyJson(request);
      if(!body)return json({error:"Invalid JSON"},400);

      const lat=Number(body.lat),lng=Number(body.lng);
      if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)
        return json({error:"Invalid coordinates"},400);

      const now=Date.now();
      const captured=Number(body.capturedAt)||now;
      await env.DB.prepare(
        "INSERT INTO locations(employee_id,lat,lng,accuracy,speed,bearing,battery,captured_at,received_at) VALUES(?,?,?,?,?,?,?,?,?)"
      ).bind(
        auth.employee_id,lat,lng,
        Number(body.accuracy)||0,
        Number(body.speed)||0,
        Number(body.bearing)||0,
        Number.isFinite(Number(body.battery))?Number(body.battery):-1,
        captured,now
      ).run();

      return json({ok:true,receivedAt:now});
    }

    if(route==="shift"&&request.method==="POST"){
      const auth=await deviceAuth(request,env);
      if(!auth)return json({error:"Unauthorized device"},401);
      const body=await bodyJson(request);
      if(!body)return json({error:"Invalid JSON"},400);
      const at=Number(body.at)||Date.now();

      if(body.type==="start"){
        await env.DB.prepare(
          "UPDATE shifts SET end_at=? WHERE employee_id=? AND end_at IS NULL"
        ).bind(at,auth.employee_id).run();
        await env.DB.prepare(
          "INSERT INTO shifts(employee_id,start_at,end_at) VALUES(?,?,NULL)"
        ).bind(auth.employee_id,at).run();
      }else if(body.type==="end"){
        await env.DB.prepare(
          "UPDATE shifts SET end_at=? WHERE employee_id=? AND end_at IS NULL"
        ).bind(at,auth.employee_id).run();
      }else return json({error:"Invalid shift type"},400);

      return json({ok:true});
    }

    if(route==="admin/ping"&&request.method==="GET"){
      return adminOk(request,env)?json({ok:true}):json({error:"Unauthorized"},401);
    }

    if(route==="admin/employees"&&request.method==="GET"){
      if(!adminOk(request,env))return json({error:"Unauthorized"},401);
      const rs=await env.DB.prepare(`
        SELECT
          d.employee_id AS id,d.name,d.enabled,d.device,d.android,d.created_at,
          l.lat,l.lng,l.accuracy,l.speed,l.bearing,l.battery,l.captured_at,l.received_at,
          (SELECT start_at FROM shifts s
            WHERE s.employee_id=d.employee_id AND s.end_at IS NULL
            ORDER BY s.start_at DESC LIMIT 1) AS shift_start
        FROM devices d
        LEFT JOIN locations l ON l.id=(
          SELECT id FROM locations x
          WHERE x.employee_id=d.employee_id
          ORDER BY x.received_at DESC LIMIT 1
        )
        WHERE d.enabled=1
        ORDER BY d.name COLLATE NOCASE
      `).all();
      return json({employees:rs.results||[],now:Date.now()});
    }

    if(route.startsWith("admin/employees/")&&request.method==="DELETE"){
      if(!adminOk(request,env))return json({error:"Unauthorized"},401);
      const id=decodeURIComponent(route.slice("admin/employees/".length)).trim().toUpperCase();
      if(!id)return json({error:"Employee ID is required"},400);

      const employee=await env.DB.prepare(
        "SELECT employee_id,name FROM devices WHERE employee_id=?"
      ).bind(id).first();

      if(!employee)return json({error:"Employee not found"},404);

      await env.DB.batch([
        env.DB.prepare("DELETE FROM locations WHERE employee_id=?").bind(id),
        env.DB.prepare("DELETE FROM shifts WHERE employee_id=?").bind(id),
        env.DB.prepare(
          "UPDATE devices SET enabled=0,updated_at=? WHERE employee_id=?"
        ).bind(Date.now(),id)
      ]);

      return json({
        ok:true,
        removed:{id:employee.employee_id,name:employee.name},
        canRestore:true
      });
    }

    if(route.startsWith("admin/devices/")&&request.method==="POST"){
      if(!adminOk(request,env))return json({error:"Unauthorized"},401);
      const id=decodeURIComponent(route.slice("admin/devices/".length)).toUpperCase();
      const body=await bodyJson(request);
      const enabled=body?.enabled?1:0;
      await env.DB.prepare(
        "UPDATE devices SET enabled=?,updated_at=? WHERE employee_id=?"
      ).bind(enabled,Date.now(),id).run();
      return json({ok:true,enabled:!!enabled});
    }

    if(route==="admin/history"&&request.method==="GET"){
      if(!adminOk(request,env))return json({error:"Unauthorized"},401);
      const id=String(url.searchParams.get("id")||"").toUpperCase();
      const from=Number(url.searchParams.get("from"))||Date.now()-86400000;
      const to=Number(url.searchParams.get("to"))||Date.now();
      const rs=await env.DB.prepare(
        "SELECT lat,lng,accuracy,speed,bearing,battery,captured_at,received_at FROM locations WHERE employee_id=? AND received_at BETWEEN ? AND ? ORDER BY received_at ASC LIMIT 12000"
      ).bind(id,from,to).all();
      const shifts=await env.DB.prepare(
        "SELECT start_at,end_at FROM shifts WHERE employee_id=? AND start_at<=? AND COALESCE(end_at,?)>=? ORDER BY start_at ASC"
      ).bind(id,to,to,from).all();
      return json({id,points:rs.results||[],shifts:shifts.results||[]});
    }

    if(route==="admin/registration"&&request.method==="GET"){
      if(!adminOk(request,env))return json({error:"Unauthorized"},401);
      const row=await env.DB.prepare(
        "SELECT value FROM settings WHERE key='registration_enabled'"
      ).first();
      return json({enabled:!row||row.value==="1"});
    }

    if(route==="admin/registration"&&request.method==="POST"){
      if(!adminOk(request,env))return json({error:"Unauthorized"},401);
      const body=await bodyJson(request);
      const value=body?.enabled?"1":"0";
      await env.DB.prepare(
        "INSERT INTO settings(key,value) VALUES('registration_enabled',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
      ).bind(value).run();
      return json({ok:true,enabled:value==="1"});
    }

    return json({error:"Not found"},404);
  }catch(e){
    return json({error:"Server error",detail:String(e?.message||e).slice(0,300)},500);
  }
}