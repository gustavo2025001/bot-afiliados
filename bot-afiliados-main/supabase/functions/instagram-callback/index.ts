import {serviceClient,encryptSecret,graphVersion} from './_shared.ts';

const FALLBACK_APP_URL='https://gustavo2025001.github.io/bot-afiliados/';

function appBaseUrl(){
  const raw=(Deno.env.get('APP_PUBLIC_URL')||FALLBACK_APP_URL).trim();
  try{
    const u=new URL(raw);
    u.search='';u.hash='';
    if(!u.pathname.endsWith('/'))u.pathname=u.pathname.replace(/[^/]*$/,'');
    return u;
  }catch{
    return new URL(FALLBACK_APP_URL);
  }
}

function finishUrl(ok:boolean){
  const out=new URL('instagram-conectado.html',appBaseUrl());
  if(!ok)out.searchParams.set('status','error');
  return out.toString();
}

function go(ok:boolean){
  return Response.redirect(finishUrl(ok),302);
}

Deno.serve(async(req)=>{
  try{
    const u=new URL(req.url);
    const code=(u.searchParams.get('code')||'').replace(/#_$/,'');
    const state=u.searchParams.get('state')||'';
    const err=u.searchParams.get('error');

    if(err){
      console.error('Instagram recusou autorização:',err,u.searchParams.get('error_description')||'');
      return go(false);
    }
    if(!code||!state){
      console.error('Instagram callback sem code/state');
      return go(false);
    }

    const sb=serviceClient();
    const {data:oauth,error:oe}=await sb.from('instagram_oauth_states').select('*').eq('state',state).maybeSingle();
    if(oe||!oauth||new Date(oauth.expires_at)<=new Date()){
      console.error('Instagram state inválido/expirado',oe||'');
      return go(false);
    }

    // Invalida o state antes da troca do código para impedir reutilização.
    await sb.from('instagram_oauth_states').delete().eq('state',state);

    const appId=Deno.env.get('INSTAGRAM_APP_ID')||'';
    const appSecret=Deno.env.get('INSTAGRAM_APP_SECRET')||'';
    const redirectUri=Deno.env.get('INSTAGRAM_REDIRECT_URI')||'';
    if(!appId||!appSecret||!redirectUri)throw new Error('Secrets do Instagram incompletos');

    const form=new FormData();
    form.set('client_id',appId);
    form.set('client_secret',appSecret);
    form.set('grant_type','authorization_code');
    form.set('redirect_uri',redirectUri);
    form.set('code',code);

    const tokenRes=await fetch('https://api.instagram.com/oauth/access_token',{method:'POST',body:form});
    const short=await tokenRes.json().catch(()=>({}));
    if(!tokenRes.ok||!short.access_token)throw new Error(short?.error_message||short?.error?.message||'Falha ao trocar o código pelo token do Instagram');

    let accessToken=String(short.access_token),expiresIn=3600;
    const exUrl=new URL('https://graph.instagram.com/access_token');
    exUrl.searchParams.set('grant_type','ig_exchange_token');
    exUrl.searchParams.set('client_secret',appSecret);
    exUrl.searchParams.set('access_token',accessToken);
    const exRes=await fetch(exUrl);
    const long=await exRes.json().catch(()=>({}));
    if(exRes.ok&&long.access_token){
      accessToken=String(long.access_token);
      expiresIn=Number(long.expires_in||5184000);
    }

    const version=graphVersion();
    let profile:any={id:String(short.user_id||''),username:''};
    const profRes=await fetch(`https://graph.instagram.com/${version}/me?fields=id,user_id,username,name,account_type&access_token=${encodeURIComponent(accessToken)}`);
    const prof=await profRes.json().catch(()=>({}));
    if(profRes.ok)profile=prof;

    const igId=String(profile.user_id||profile.id||short.user_id||'');
    if(!igId)throw new Error('A Meta não retornou o ID da conta do Instagram');

    const enc=await encryptSecret(accessToken);
    const now=new Date().toISOString();
    const exp=new Date(Date.now()+expiresIn*1000).toISOString();

    const {error:ce}=await sb.from('instagram_credentials').upsert({
      user_id:oauth.user_id,
      instagram_user_id:igId,
      username:String(profile.username||''),
      account_type:String(profile.account_type||''),
      access_token_enc:enc,
      token_expires_at:exp,
      graph_version:version,
      status:'connected',
      last_verified_at:now,
      updated_at:now
    },{onConflict:'user_id'});
    if(ce)throw ce;

    const {error:ie}=await sb.from('integrations').upsert({
      user_id:oauth.user_id,
      provider:'instagram',
      status:'connected',
      external_account_id:igId,
      metadata:{username:String(profile.username||''),account_type:String(profile.account_type||''),instagram_login:true,content_publish:true},
      updated_at:now
    },{onConflict:'user_id,provider'});
    if(ie)throw ie;

    console.log('Instagram conectado com sucesso para user_id:',oauth.user_id,'username:',String(profile.username||''));
    return go(true);
  }catch(e){
    console.error('instagram-callback:',e);
    return go(false);
  }
});
