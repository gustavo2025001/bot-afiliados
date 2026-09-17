import {cors,json,serviceClient,requireUser,decryptSecret,encryptSecret,graphVersion} from './_shared.ts';
function captionFor(p:any){const price=Number(p.price||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});const old=Number(p.old_price||0)>Number(p.price||0)?`\n💸 De: ${Number(p.old_price).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}`:'';const disc=Number(p.discount_percent||0)>0?`\n🔥 ${Number(p.discount_percent)}% OFF`:'';return `🔥 OFERTA ESPECIAL 🔥\n\n🛍️ ${p.title}${old}\n💰 Por: ${price}${disc}\n\n🔗 Link da oferta: ${p.affiliate_url}\n\n#ofertas #promocao #achadinhos`.slice(0,2200);}
async function ensureToken(cred:any,sb:any){let token=await decryptSecret(cred.access_token_enc);const exp=cred.token_expires_at?new Date(cred.token_expires_at).getTime():0;if(exp&&exp-Date.now()<7*24*60*60*1000){const u=new URL('https://graph.instagram.com/refresh_access_token');u.searchParams.set('grant_type','ig_refresh_token');u.searchParams.set('access_token',token);const r=await fetch(u);const d=await r.json().catch(()=>({}));if(r.ok&&d.access_token){token=String(d.access_token);await sb.from('instagram_credentials').update({access_token_enc:await encryptSecret(token),token_expires_at:new Date(Date.now()+Number(d.expires_in||5184000)*1000).toISOString(),updated_at:new Date().toISOString()}).eq('user_id',cred.user_id);}}return token;}
Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return json({error:'Método não permitido'},405);
  let authClient:any=null,reservedLogId:string|null=null;
  try{
    const auth=await requireUser(req);authClient=auth.client;const user=auth.user;const body=await req.json().catch(()=>({}));const productId=String(body.product_id||'').trim();if(!productId)return json({error:'Produto não informado.'},400);
    const sb=serviceClient();
    const {data:product,error:pe}=await sb.from('products').select('*').eq('id',productId).eq('user_id',user.id).maybeSingle();if(pe)throw pe;if(!product)return json({error:'Produto não encontrado.'},404);
    if(!/^https:\/\//i.test(String(product.image_url||'')))return json({error:'A oferta precisa ter uma imagem pública HTTPS para o Instagram.'},400);
    const {data:cred,error:ce}=await sb.from('instagram_credentials').select('*').eq('user_id',user.id).maybeSingle();if(ce)throw ce;if(!cred||cred.status!=='connected')return json({error:'Instagram ainda não está conectado.'},400);
    const {data:reserve,error:re}=await authClient.rpc('reserve_instagram_share',{target_product:productId});if(re)return json({error:re.message},400);reservedLogId=reserve?.log_id||null;
    const token=await ensureToken(cred,sb),version=cred.graph_version||graphVersion(),caption=String(body.caption||captionFor(product)).slice(0,2200);
    const create=new URLSearchParams({image_url:String(product.image_url),caption,access_token:token});
    const cRes=await fetch(`https://graph.instagram.com/${version}/${cred.instagram_user_id}/media`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:create});const c=await cRes.json().catch(()=>({}));
    if(!cRes.ok||!c.id){const msg=c?.error?.message||'A Meta recusou a criação da publicação.';if(reservedLogId)await authClient.rpc('fail_instagram_share',{target_log:reservedLogId,target_error:msg,target_meta:{stage:'create_container',meta_code:c?.error?.code||null}});reservedLogId=null;return json({error:msg},400);}
    const publish=new URLSearchParams({creation_id:String(c.id),access_token:token});
    const pRes=await fetch(`https://graph.instagram.com/${version}/${cred.instagram_user_id}/media_publish`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:publish});const pub=await pRes.json().catch(()=>({}));
    if(!pRes.ok||!pub.id){const msg=pub?.error?.message||'A Meta recusou a publicação.';if(reservedLogId)await authClient.rpc('fail_instagram_share',{target_log:reservedLogId,target_error:msg,target_meta:{stage:'media_publish',container_id:c.id,meta_code:pub?.error?.code||null}});reservedLogId=null;return json({error:msg},400);}
    if(reservedLogId)await authClient.rpc('complete_instagram_share',{target_log:reservedLogId,target_external_id:String(pub.id),target_meta:{container_id:c.id,username:cred.username||null}});
    return json({success:true,media_id:String(pub.id),username:cred.username||null,used:reserve?.used??null,limit:reserve?.limit??null,unlimited:reserve?.unlimited??false});
  }catch(e){if(reservedLogId&&authClient){try{await authClient.rpc('fail_instagram_share',{target_log:reservedLogId,target_error:e instanceof Error?e.message:String(e),target_meta:{stage:'exception'}})}catch(_){}}console.error(e);return json({error:e instanceof Error?e.message:String(e)},500);}
});
