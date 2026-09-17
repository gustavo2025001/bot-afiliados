import {cors,json,serviceClient,requireUser} from './_shared.ts';
Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(!['GET','POST'].includes(req.method))return json({error:'Método não permitido'},405);
  try{
    const {user}=await requireUser(req);
    const appId=(Deno.env.get('INSTAGRAM_APP_ID')||'').trim();
    const redirectUri=(Deno.env.get('INSTAGRAM_REDIRECT_URI')||'').trim();
    if(!appId||!redirectUri)throw new Error('INSTAGRAM_APP_ID ou INSTAGRAM_REDIRECT_URI não configurado no Supabase Secrets');
    const state=crypto.randomUUID();
    const sb=serviceClient();
    await sb.from('instagram_oauth_states').delete().lt('expires_at',new Date().toISOString());
    const {error}=await sb.from('instagram_oauth_states').insert({state,user_id:user.id,expires_at:new Date(Date.now()+10*60*1000).toISOString()});
    if(error)throw error;
    const url=new URL('https://www.instagram.com/oauth/authorize');
    url.searchParams.set('client_id',appId);
    url.searchParams.set('redirect_uri',redirectUri);
    url.searchParams.set('response_type','code');
    url.searchParams.set('scope','instagram_business_basic,instagram_business_content_publish');
    url.searchParams.set('state',state);
    url.searchParams.set('enable_fb_login','0');
    url.searchParams.set('force_reauth','true');
    return json({success:true,authorization_url:url.toString()});
  }catch(e){console.error(e);return json({error:e instanceof Error?e.message:String(e)},500);}
});
