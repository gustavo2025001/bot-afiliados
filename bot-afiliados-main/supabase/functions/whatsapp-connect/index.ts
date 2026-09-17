import {cors,json,serviceClient,requireUser,encryptSecret,digits,graphFetch,graphVersion} from './_shared.ts';

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  if(req.method!=='POST') return json({error:'Método não permitido'},405);
  try{
    const {user}=await requireUser(req);
    const body=await req.json().catch(()=>({}));
    const wabaId=digits(body.waba_id);
    const phoneNumberId=digits(body.phone_number_id);
    const accessToken=String(body.access_token||'').trim();
    const defaultRecipient=digits(body.default_recipient);

    if(!wabaId||!phoneNumberId||!accessToken) return json({error:'Informe WABA ID, Phone Number ID e Access Token.'},400);
    if(accessToken.length<30) return json({error:'O Access Token parece incompleto.'},400);

    const phonesRes=await graphFetch(`${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name&limit=100`,accessToken);
    const phonesJson=await phonesRes.json().catch(()=>({}));
    if(!phonesRes.ok){
      return json({error:'A Meta recusou as credenciais.',details:phonesJson?.error?.message||'Não foi possível consultar a conta do WhatsApp Business.'},400);
    }

    const match=Array.isArray(phonesJson.data)?phonesJson.data.find((x:any)=>String(x.id)===phoneNumberId):null;
    if(!match) return json({error:'O Phone Number ID não pertence ao WABA ID informado.'},400);

    const accessTokenEnc=await encryptSecret(accessToken);
    const defaultRecipientEnc=defaultRecipient?await encryptSecret(defaultRecipient):null;
    const sb=serviceClient();
    const now=new Date().toISOString();

    const {error:credError}=await sb.from('whatsapp_credentials').upsert({
      user_id:user.id,
      waba_id:wabaId,
      phone_number_id:phoneNumberId,
      access_token_enc:accessTokenEnc,
      default_recipient_enc:defaultRecipientEnc,
      graph_version:graphVersion(),
      verified_name:String(match.verified_name||''),
      display_phone_number:String(match.display_phone_number||''),
      status:'connected',
      last_verified_at:now,
      updated_at:now
    },{onConflict:'user_id'});
    if(credError) throw credError;

    const last4=digits(match.display_phone_number).slice(-4);
    const {error:intError}=await sb.from('integrations').upsert({
      user_id:user.id,
      provider:'whatsapp',
      status:'connected',
      external_account_id:wabaId,
      metadata:{
        verified_name:String(match.verified_name||''),
        phone_last4:last4,
        graph_version:graphVersion(),
        cloud_api:true
      },
      updated_at:now
    },{onConflict:'user_id,provider'});
    if(intError) throw intError;

    return json({
      success:true,
      connected:true,
      verified_name:String(match.verified_name||''),
      phone_mask:last4?`••••${last4}`:'configurado',
      has_default_recipient:!!defaultRecipient
    });
  }catch(e){
    console.error(e);
    return json({error:e instanceof Error?e.message:String(e)},500);
  }
});
