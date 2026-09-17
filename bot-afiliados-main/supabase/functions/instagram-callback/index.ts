import {serviceClient,encryptSecret,graphVersion} from './_shared.ts';
function page(title:string,message:string,ok=true){return new Response(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="margin:0;background:#080b14;color:#fff;font-family:Arial;display:grid;place-items:center;min-height:100vh"><main style="max-width:560px;padding:36px;border:1px solid #34304d;border-radius:20px;background:#111525;text-align:center"><div style="font-size:56px">${ok?'📸':'⚠️'}</div><h1>${title}</h1><p style="color:#aeb7cc;line-height:1.6">${message}</p></main></body></html>`,{status:ok?200:400,headers:{'content-type':'text/html; charset=utf-8'}});}
Deno.serve(async(req)=>{
  try{
    const u=new URL(req.url),code=(u.searchParams.get('code')||'').replace(/#_$/,''),state=u.searchParams.get('state')||'',err=u.searchParams.get('error');
    if(err)return page('Instagram não conectado',u.searchParams.get('error_description')||err,false);
    if(!code||!state)return page('Instagram não conectado','Código ou state não recebido.',false);
    const sb=serviceClient();
    const {data:oauth,error:oe}=await sb.from('instagram_oauth_states').select('*').eq('state',state).maybeSingle();
    if(oe||!oauth||new Date(oauth.expires_at)<=new Date())return page('Instagram não conectado','Autorização expirada. Volte ao Bot e tente novamente.',false);
    await sb.from('instagram_oauth_states').delete().eq('state',state);
    const appId=Deno.env.get('INSTAGRAM_APP_ID')||'',appSecret=Deno.env.get('INSTAGRAM_APP_SECRET')||'',redirectUri=Deno.env.get('INSTAGRAM_REDIRECT_URI')||'';
    if(!appId||!appSecret||!redirectUri)throw new Error('Secrets do Instagram incompletos');
    const form=new FormData();form.set('client_id',appId);form.set('client_secret',appSecret);form.set('grant_type','authorization_code');form.set('redirect_uri',redirectUri);form.set('code',code);
    const tokenRes=await fetch('https://api.instagram.com/oauth/access_token',{method:'POST',body:form});
    const short=await tokenRes.json().catch(()=>({}));
    if(!tokenRes.ok||!short.access_token)throw new Error(short?.error_message||short?.error?.message||'Falha ao trocar o código pelo token do Instagram');
    let accessToken=String(short.access_token),expiresIn=3600;
    const exUrl=new URL('https://graph.instagram.com/access_token');exUrl.searchParams.set('grant_type','ig_exchange_token');exUrl.searchParams.set('client_secret',appSecret);exUrl.searchParams.set('access_token',accessToken);
    const exRes=await fetch(exUrl);const long=await exRes.json().catch(()=>({}));
    if(exRes.ok&&long.access_token){accessToken=String(long.access_token);expiresIn=Number(long.expires_in||5184000);}
    const version=graphVersion();
    let profile:any={id:String(short.user_id||''),username:''};
    const profRes=await fetch(`https://graph.instagram.com/${version}/me?fields=id,user_id,username,name,account_type&access_token=${encodeURIComponent(accessToken)}`);
    const prof=await profRes.json().catch(()=>({}));
    if(profRes.ok)profile=prof;
    const igId=String(profile.user_id||profile.id||short.user_id||'');
    if(!igId)throw new Error('A Meta não retornou o ID da conta do Instagram');
    const enc=await encryptSecret(accessToken),now=new Date().toISOString(),exp=new Date(Date.now()+expiresIn*1000).toISOString();
    const {error:ce}=await sb.from('instagram_credentials').upsert({user_id:oauth.user_id,instagram_user_id:igId,username:String(profile.username||''),account_type:String(profile.account_type||''),access_token_enc:enc,token_expires_at:exp,graph_version:version,status:'connected',last_verified_at:now,updated_at:now},{onConflict:'user_id'});if(ce)throw ce;
    const {error:ie}=await sb.from('integrations').upsert({user_id:oauth.user_id,provider:'instagram',status:'connected',external_account_id:igId,metadata:{username:String(profile.username||''),account_type:String(profile.account_type||''),instagram_login:true,content_publish:true},updated_at:now},{onConflict:'user_id,provider'});if(ie)throw ie;
    const appUrl=(Deno.env.get('APP_PUBLIC_URL')||'').trim();
    if(appUrl){const out=new URL(appUrl);out.searchParams.set('ig','connected');return Response.redirect(out.toString(),302);}
    return page('Instagram conectado!','A autorização foi concluída. Volte para o Bot Afiliados.');
  }catch(e){console.error(e);return page('Erro ao conectar Instagram',e instanceof Error?e.message:String(e),false);}
});
