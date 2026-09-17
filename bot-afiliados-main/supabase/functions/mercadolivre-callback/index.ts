import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    if (!code) return new Response("Mercado Livre: código de autorização não recebido.", { status: 400 });
    const clientId = Deno.env.get("MERCADOLIVRE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("MERCADOLIVRE_CLIENT_SECRET")!;
    const redirectUri = Deno.env.get("MERCADOLIVRE_REDIRECT_URI")!;
    const tokenRes = await fetch("https://api.mercadolibre.com/oauth/token", {method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"authorization_code",client_id:clientId,client_secret:clientSecret,code,redirect_uri:redirectUri})});
    const token = await tokenRes.json();
    if (!tokenRes.ok) return new Response("Falha ao conectar Mercado Livre: "+JSON.stringify(token), {status:500});
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const expiresAt = new Date(Date.now() + Number(token.expires_in || 21600)*1000).toISOString();
    const { error } = await sb.from("mercadolivre_tokens").upsert({id:1,user_id:String(token.user_id||''),access_token:token.access_token,refresh_token:token.refresh_token,expires_at:expiresAt,updated_at:new Date().toISOString()},{onConflict:"id"});
    if(error) throw error;
    return new Response(`<!doctype html><meta charset="utf-8"><title>Mercado Livre conectado</title><body style="font-family:Arial;background:#07101a;color:white;text-align:center;padding:70px"><h1>✅ Mercado Livre conectado!</h1><p>O Bot Afiliados V5 já recebeu a autorização.</p><p>Pode fechar esta janela e clicar em <b>Verificar conexão</b> no bot.</p></body>`,{headers:{"content-type":"text/html; charset=utf-8"}});
  } catch (e) { return new Response("Erro: "+String(e), {status:500}); }
});
