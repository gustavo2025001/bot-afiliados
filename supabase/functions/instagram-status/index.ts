import {cors,json,serviceClient,requireUser} from './_shared.ts';
Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='GET')return json({error:'Método não permitido'},405);
  try{
    const {user}=await requireUser(req);const sb=serviceClient();
    const {data,error}=await sb.from('instagram_credentials').select('instagram_user_id,username,account_type,status,token_expires_at,last_verified_at').eq('user_id',user.id).maybeSingle();
    if(error)throw error;
    return json({connected:!!data&&data.status==='connected',username:data?.username||null,account_type:data?.account_type||null,token_expires_at:data?.token_expires_at||null,last_verified_at:data?.last_verified_at||null});
  }catch(e){console.error(e);return json({error:e instanceof Error?e.message:String(e)},500);}
});
