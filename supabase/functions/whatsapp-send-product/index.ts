import {cors,json,serviceClient,requireUser,decryptSecret,digits,graphFetch} from './_shared.ts';

function adMessage(p:any){
  const price=Number(p.price||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const old=Number(p.old_price||0);
  const oldLine=old>Number(p.price||0)?`\nDe: ${old.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}`:'';
  const discount=Number(p.discount_percent||0)>0?`\n🔥 ${Number(p.discount_percent)}% OFF`:'';
  return `🛍️ *${p.title}*${oldLine}\nPor: *${price}*${discount}\n\n👉 ${p.affiliate_url}`.slice(0,4096);
}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  if(req.method!=='POST') return json({error:'Método não permitido'},405);
  let authClient:any=null;
  let reservedLogId:string|null=null;
  try{
    const auth=await requireUser(req);
    authClient=auth.client;
    const user=auth.user;
    const body=await req.json().catch(()=>({}));
    const productId=String(body.product_id||'').trim();
    if(!productId) return json({error:'Produto não informado.'},400);

    const service=serviceClient();
    const {data:product,error:prodError}=await service.from('products').select('*').eq('id',productId).eq('user_id',user.id).maybeSingle();
    if(prodError) throw prodError;
    if(!product) return json({error:'Produto não encontrado.'},404);

    const {data:cred,error:credError}=await service.from('whatsapp_credentials').select('*').eq('user_id',user.id).maybeSingle();
    if(credError) throw credError;
    if(!cred||cred.status!=='connected') return json({error:'WhatsApp Cloud API ainda não está conectada.'},400);

    let to=digits(body.to);
    if(!to&&cred.default_recipient_enc) to=digits(await decryptSecret(cred.default_recipient_enc));
    if(!to) return json({error:'Configure um destinatário padrão na integração do WhatsApp.'},400);

    const {data:reserve,error:reserveError}=await authClient.rpc('reserve_cloud_share',{target_product:productId,target_provider:'whatsapp'});
    if(reserveError) return json({error:reserveError.message},400);
    reservedLogId=reserve?.log_id||null;

    const token=await decryptSecret(cred.access_token_enc);
    const message=String(body.message||adMessage(product)).slice(0,4096);
    const metaRes=await graphFetch(`${cred.phone_number_id}/messages`,token,{
      method:'POST',
      body:JSON.stringify({messaging_product:'whatsapp',recipient_type:'individual',to,type:'text',text:{preview_url:true,body:message}})
    });
    const meta=await metaRes.json().catch(()=>({}));
    if(!metaRes.ok){
      if(reservedLogId) await authClient.rpc('fail_cloud_share',{target_log:reservedLogId,target_error:meta?.error?.message||'Falha na Meta',target_meta:{meta_code:meta?.error?.code||null}});
      reservedLogId=null;
      return json({error:meta?.error?.message||'A Meta recusou o envio.',meta_code:meta?.error?.code||null},400);
    }

    const messageId=meta?.messages?.[0]?.id||'';
    if(reservedLogId){
      const {error:completeError}=await authClient.rpc('complete_cloud_share',{target_log:reservedLogId,target_external_id:messageId,target_meta:{recipient_last4:to.slice(-4)}});
      if(completeError) console.error('complete_cloud_share:',completeError);
    }

    return json({success:true,message_id:messageId,to_mask:`••••${to.slice(-4)}`,used:reserve?.used??null,limit:reserve?.limit??null,unlimited:reserve?.unlimited??false});
  }catch(e){
    if(reservedLogId&&authClient){
      try{await authClient.rpc('fail_cloud_share',{target_log:reservedLogId,target_error:e instanceof Error?e.message:String(e),target_meta:{stage:'exception'}});}catch(_){/* noop */}
    }
    console.error(e);
    return json({error:e instanceof Error?e.message:String(e)},500);
  }
});
