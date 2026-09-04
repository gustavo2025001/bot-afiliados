import {cors,json,serviceClient,requireUser,decryptSecret,digits,graphFetch} from './_shared.ts';

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  if(req.method!=='POST') return json({error:'Método não permitido'},405);
  try{
    const {user}=await requireUser(req);
    const body=await req.json().catch(()=>({}));
    const sb=serviceClient();
    const {data:cred,error}=await sb.from('whatsapp_credentials').select('*').eq('user_id',user.id).maybeSingle();
    if(error) throw error;
    if(!cred||cred.status!=='connected') return json({error:'WhatsApp Cloud API ainda não está conectada.'},400);

    const token=await decryptSecret(cred.access_token_enc);
    let to=digits(body.to);
    if(!to&&cred.default_recipient_enc) to=digits(await decryptSecret(cred.default_recipient_enc));
    if(!to) return json({error:'Informe um número de destino com DDI, somente números.'},400);

    const message=String(body.message||'Olá! Esta é uma mensagem de teste do Bot Afiliados Premium. ✅').trim().slice(0,4096);
    const metaRes=await graphFetch(`${cred.phone_number_id}/messages`,token,{
      method:'POST',
      body:JSON.stringify({messaging_product:'whatsapp',recipient_type:'individual',to,type:'text',text:{preview_url:false,body:message}})
    });
    const meta=await metaRes.json().catch(()=>({}));
    if(!metaRes.ok) return json({error:meta?.error?.message||'A Meta recusou a mensagem de teste.',meta_code:meta?.error?.code||null},400);

    return json({success:true,message_id:meta?.messages?.[0]?.id||null,to_mask:`••••${to.slice(-4)}`});
  }catch(e){
    console.error(e);
    return json({error:e instanceof Error?e.message:String(e)},500);
  }
});
