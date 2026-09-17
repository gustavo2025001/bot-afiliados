import {cors,json,serviceClient,requireUser,digits} from './_shared.ts';

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  try{
    const {user}=await requireUser(req);
    const sb=serviceClient();
    const {data,error}=await sb.from('whatsapp_credentials')
      .select('status,verified_name,display_phone_number,default_recipient_enc,last_verified_at,updated_at')
      .eq('user_id',user.id).maybeSingle();
    if(error) throw error;
    if(!data) return json({connected:false,status:'disconnected'});
    const last4=digits(data.display_phone_number).slice(-4);
    return json({
      connected:data.status==='connected',
      status:data.status,
      verified_name:data.verified_name||null,
      phone_mask:last4?`••••${last4}`:null,
      has_default_recipient:!!data.default_recipient_enc,
      last_verified_at:data.last_verified_at||data.updated_at||null
    });
  }catch(e){
    return json({connected:false,error:e instanceof Error?e.message:String(e)},500);
  }
});
