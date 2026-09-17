// Bot Afiliados V5 Multiplataforma — integração Mercado Livre corrigida
// IMPORTANTE: esta é uma chave publishable/anon. Nunca use service_role no navegador/GitHub.
const SUPABASE_URL='https://jhdezfnafhekimolfiuu.supabase.co';
const SUPABASE_ANON_KEY='sb_publishable_lAfLqmLZ0rp9UZHATVXtyg_4Wmsn18i';
const sb=supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
const $=id=>document.getElementById(id);

const state={user:null,profile:null,subscription:null,planStatus:null,products:[],campaigns:[],schedules:[],posts:[],integrations:[]};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const fmtDate=v=>v?new Date(v).toLocaleString('pt-BR'):'—';
const toast=(text,type='')=>{const el=$('toast');el.textContent=text;el.className='toast '+type;clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.add('hidden'),4200)};
const modal=id=>$(id).classList.remove('hidden');
const closeModal=id=>$(id).classList.add('hidden');

function tabs(w){$('signupView').classList.toggle('hidden',w!=='signup');$('loginView').classList.toggle('hidden',w!=='login');$('signupTab').classList.toggle('active',w==='signup');$('loginTab').classList.toggle('active',w==='login');$('msg').textContent=''}
$('signupTab').onclick=()=>tabs('signup');$('loginTab').onclick=()=>tabs('login');$('backLogin').onclick=()=>{$('verifyCard').classList.add('hidden');$('authCard').classList.remove('hidden');tabs('login')};
function passwordOK(p){return p.length>=8&&/[A-Z]/.test(p)&&/[0-9]/.test(p)&&/[^A-Za-z0-9]/.test(p)}
$('signupPassword').oninput=e=>{let p=e.target.value,c=[p.length>=8,/[A-Z]/.test(p),/[0-9]/.test(p),/[^A-Za-z0-9]/.test(p)];c.forEach((x,i)=>$('r'+(i+1)).classList.toggle('ok',x));let n=c.filter(Boolean).length;$('strengthBar').style.width=n*25+'%';$('strengthText').textContent=n<2?'Fraca':n<4?'Média':'Forte'};

$('signupBtn').onclick=async()=>{
  let name=$('name').value.trim(),email=$('signupEmail').value.trim(),phone=$('phone').value.trim(),p=$('signupPassword').value;
  if(!name||!email||!phone||!p)return $('msg').textContent='Preencha todos os campos.';
  if(phone!==$('phone2').value.trim())return $('msg').textContent='Os telefones não conferem.';
  if(p!==$('password2').value)return $('msg').textContent='As senhas não conferem.';
  if(!passwordOK(p))return $('msg').textContent='A senha ainda não atende às regras.';
  if(!$('terms').checked)return $('msg').textContent='Aceite os termos.';
  $('msg').textContent='Criando conta...';
  let{data,error}=await sb.auth.signUp({email,password:p,options:{data:{name,phone},emailRedirectTo:location.origin+location.pathname}});
  if(error)return $('msg').textContent=error.message;
  if(data.session)return boot(data.user);
  $('verifyEmail').textContent=email;$('authCard').classList.add('hidden');$('verifyCard').classList.remove('hidden');
};
$('loginBtn').onclick=async()=>{let{data,error}=await sb.auth.signInWithPassword({email:$('loginEmail').value.trim(),password:$('loginPassword').value});if(error)return $('msg').textContent=error.message;boot(data.user)};
$('forgotBtn').onclick=async()=>{let email=$('loginEmail').value.trim();if(!email)return $('msg').textContent='Digite seu e-mail primeiro.';let{error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});$('msg').textContent=error?error.message:'Link de recuperação enviado.'};
$('logoutBtn').onclick=async()=>{await sb.auth.signOut();location.reload()};

function subscriptionActive(){
  if(isAdmin())return true;
  if(state.planStatus)return state.planStatus.allowed===true;
  if(!state.subscription)return false;
  return state.subscription.status==='active' && (!state.subscription.current_period_end || new Date(state.subscription.current_period_end)>new Date());
}

function isAdmin(){return state.profile?.role==='admin'}
function enforceGate(){
  const active=subscriptionActive();
  $('subscriptionGate').classList.toggle('hidden',active||isAdmin());
  document.querySelectorAll('.protected').forEach(el=>el.classList.toggle('locked',!active&&!isAdmin()));
  document.querySelectorAll('.protectedAction').forEach(el=>el.disabled=!active&&!isAdmin());
  const plan=state.subscription?.plan_code?.toUpperCase()||'SEM PLANO';
  $('planBadge').textContent=isAdmin()?'ADMIN':plan;
  $('planBadge').className='badge '+((active||isAdmin())?'success':'warning');
  $('accountStatus').textContent=(active||isAdmin())?'● Conta liberada':'● Acesso limitado';
  $('currentPlan').textContent=isAdmin()?'ADMIN':plan;
  $('planExpiry').textContent=state.subscription?.current_period_end?'Até '+new Date(state.subscription.current_period_end).toLocaleDateString('pt-BR'):'Sem assinatura';
  $('planCardName').textContent=isAdmin()?'ADMIN':plan;
  $('planCardStatus').textContent=(active||isAdmin())?'Acesso liberado':'Acesso limitado';
  const ps=state.planStatus;
  const used=isAdmin()?'Ilimitado':(ps?.daily_limit==null&&active?'Ilimitado':`${ps?.used_today||0}/${ps?.daily_limit||0}`);
  $('dailyUsage').textContent=used;
  $('dailyUsageHelp').textContent=isAdmin()?'Admin sem limite':(ps?.daily_limit==null&&active?'Compartilhamentos ilimitados':'Compartilhamentos usados hoje');
  $('planCardHelp').textContent=(active||isAdmin())?'Recursos disponíveis conforme o plano.':'Escolha um plano para liberar as funções.';
}
function requireAccess(){if(subscriptionActive()||isAdmin())return true;toast('Assinatura ativa necessária.','error');showView('plans');return false}

async function boot(user){
  state.user=user;$('authShell').classList.add('hidden');$('panel').classList.remove('hidden');
  const n=user.user_metadata?.name||user.email?.split('@')[0]||'Usuário';$('welcome').textContent=n+' 👋';$('sideName').textContent=n;
  await loadAccount();
  enforceGate();
  if(isAdmin())document.querySelectorAll('.adminOnly').forEach(x=>x.classList.remove('hidden'));
  await Promise.all([loadProducts(),loadCampaigns(),loadSchedules(),loadPosts(),loadIntegrations()]);
  if(isAdmin())loadAdmin();
}
async function loadAccount(){
  const [{data:profile,error:pe},{data:sub,error:se}]=await Promise.all([
    sb.from('profiles').select('*').eq('id',state.user.id).maybeSingle(),
    sb.from('subscriptions').select('*').eq('user_id',state.user.id).order('created_at',{ascending:false}).limit(1).maybeSingle()
  ]);
  if(pe)toast('Execute o SQL da V4 no Supabase: '+pe.message,'error');
  state.profile=profile;state.subscription=sub;
  const {data:planStatus,error:pse}=await sb.rpc('my_plan_status');
  if(!pse)state.planStatus=planStatus;
  else state.planStatus=null;
}

function showView(name){
  if(['products','campaigns','schedules','integrations','reports'].includes(name)&&!requireAccess())return;
  if(name==='admin'&&!isAdmin())return toast('Acesso administrativo negado.','error');
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));$('view-'+name)?.classList.add('active');
  document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.view===name));
}
document.querySelectorAll('.nav').forEach(btn=>btn.onclick=()=>showView(btn.dataset.view));
document.querySelectorAll('[data-view-jump]').forEach(btn=>btn.onclick=()=>showView(btn.dataset.viewJump));
document.querySelectorAll('[data-open-plans]').forEach(btn=>btn.onclick=()=>showView('plans'));
document.querySelectorAll('.closeModal').forEach(btn=>btn.onclick=()=>closeModal(btn.dataset.modal));

$('newProduct').onclick=$('newProduct2').onclick=$('quickProduct').onclick=()=>{if(!requireAccess())return;modal('productModal')};
$('newCampaign').onclick=()=>{if(!requireAccess())return;fillCampaignProducts();modal('campaignModal')};
$('newSchedule').onclick=()=>{if(!requireAccess())return;fillScheduleCampaigns();modal('scheduleModal')};

async function loadProducts(){
  const{data,error}=await sb.from('products').select('*').order('created_at',{ascending:false});
  if(error){renderDbError('productList','Produtos',error);return} state.products=data||[];renderProducts();
}
function renderProducts(){
  $('productCount').textContent=state.products.length;$('emptyHint').textContent=state.products.length?state.products.length+' produto(s)':'Cadastre o primeiro';
  const rows=state.products.map(p=>`<div class="tableRow"><div><b>${esc(p.title)}</b><small>${esc(p.affiliate_url)}</small></div><span class="tag">${esc(p.platform)}</span><span>${money(p.price)}</span><button class="dangerBtn" onclick="deleteProduct('${p.id}')">Excluir</button></div>`).join('')||'<div class="empty">Nenhum produto cadastrado.</div>';
  $('productList').innerHTML=rows;
  $('productListMini').innerHTML=state.products.slice(0,5).map(p=>`<div class="row"><div class="prodIcon">🛍</div><div><b>${esc(p.title)}</b><small>${esc(p.platform)} • ${money(p.price)}</small></div><a href="${esc(p.affiliate_url)}" target="_blank" rel="noopener">Abrir</a><span></span></div>`).join('')||'<div class="empty">Nenhum produto cadastrado.</div>';
}
$('saveProduct').onclick=async()=>{
  if(!requireAccess())return;const title=$('pTitle').value.trim(),link=$('pLink').value.trim();if(!title||!link)return $('pMsg').textContent='Preencha título e link.';
  $('pMsg').textContent='Salvando...';
  const payload={user_id:state.user.id,title,price:Number(String($('pPrice').value).replace(',','.'))||0,platform:$('pPlatform').value,affiliate_url:link,image_url:$('pImage').value.trim()||null};
  const{error}=await sb.from('products').insert(payload);if(error)return $('pMsg').textContent=error.message;
  ['pTitle','pPrice','pLink','pImage'].forEach(id=>$(id).value='');$('pMsg').textContent='';closeModal('productModal');await loadProducts();toast('Produto salvo no Supabase.','ok');
};
window.deleteProduct=async id=>{if(!requireAccess())return;const{error}=await sb.from('products').delete().eq('id',id);if(error)return toast(error.message,'error');await loadProducts();toast('Produto excluído.','ok')};

function fillCampaignProducts(){$('cProduct').innerHTML='<option value="">Sem produto</option>'+state.products.map(p=>`<option value="${p.id}">${esc(p.title)}</option>`).join('')}
async function loadCampaigns(){const{data,error}=await sb.from('campaigns').select('*,products(title)').order('created_at',{ascending:false});if(error){renderDbError('campaignList','Campanhas',error);return}state.campaigns=data||[];renderCampaigns()}
function renderCampaigns(){$('campaignCount').textContent=state.campaigns.length;$('campaignList').innerHTML=state.campaigns.map(c=>`<div class="tableRow"><div><b>${esc(c.name)}</b><small>${esc(c.products?.title||'Sem produto')}</small></div><span>${esc((c.channels||[]).join(', '))}</span><span class="tag">${esc(c.status)}</span><button class="dangerBtn" onclick="deleteCampaign('${c.id}')">Excluir</button></div>`).join('')||'<div class="empty">Nenhuma campanha criada.</div>'}
$('saveCampaign').onclick=async()=>{if(!requireAccess())return;const name=$('cName').value.trim(),message=$('cMessage').value.trim(),channels=[...document.querySelectorAll('input[name="channel"]:checked')].map(x=>x.value);if(!name||!message||!channels.length)return $('cMsg').textContent='Informe nome, mensagem e ao menos um canal.';const{error}=await sb.from('campaigns').insert({user_id:state.user.id,name,product_id:$('cProduct').value||null,message,channels,status:'draft'});if(error)return $('cMsg').textContent=error.message;$('cName').value=$('cMessage').value='';document.querySelectorAll('input[name="channel"]').forEach(x=>x.checked=false);closeModal('campaignModal');await loadCampaigns();toast('Campanha criada.','ok')};
window.deleteCampaign=async id=>{if(!requireAccess())return;const{error}=await sb.from('campaigns').delete().eq('id',id);if(error)return toast(error.message,'error');await Promise.all([loadCampaigns(),loadSchedules()]);toast('Campanha excluída.','ok')};

function fillScheduleCampaigns(){$('sCampaign').innerHTML=state.campaigns.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')||'<option value="">Crie uma campanha primeiro</option>'}
async function loadSchedules(){const{data,error}=await sb.from('schedules').select('*,campaigns(name)').order('scheduled_for',{ascending:true});if(error){renderDbError('scheduleList','Agendamentos',error);return}state.schedules=data||[];renderSchedules()}
function renderSchedules(){$('scheduleCount').textContent=state.schedules.filter(s=>s.status==='pending').length;const html=state.schedules.map(s=>`<div class="tableRow"><div><b>${esc(s.campaigns?.name||'Campanha')}</b><small>${fmtDate(s.scheduled_for)}</small></div><span class="tag">${esc(s.status)}</span><span>${esc(s.timezone||'America/Sao_Paulo')}</span><button class="dangerBtn" onclick="deleteSchedule('${s.id}')">Excluir</button></div>`).join('')||'<div class="empty">Nenhum agendamento.</div>';$('scheduleList').innerHTML=html;$('scheduleListMini').innerHTML=state.schedules.slice(0,4).map(s=>`<div class="row"><div class="prodIcon">◷</div><div><b>${esc(s.campaigns?.name||'Campanha')}</b><small>${fmtDate(s.scheduled_for)}</small></div><span class="tag">${esc(s.status)}</span><span></span></div>`).join('')||'<div class="empty">Nenhum agendamento.</div>'}
$('saveSchedule').onclick=async()=>{if(!requireAccess())return;const campaign_id=$('sCampaign').value,when=$('sWhen').value;if(!campaign_id||!when)return $('sMsg').textContent='Selecione a campanha e a data.';const d=new Date(when);if(d<=new Date())return $('sMsg').textContent='Escolha uma data futura.';const{error}=await sb.from('schedules').insert({user_id:state.user.id,campaign_id,scheduled_for:d.toISOString(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'America/Sao_Paulo',status:'pending'});if(error)return $('sMsg').textContent=error.message;$('sWhen').value='';closeModal('scheduleModal');await loadSchedules();toast('Agendamento criado.','ok')};
window.deleteSchedule=async id=>{if(!requireAccess())return;const{error}=await sb.from('schedules').delete().eq('id',id);if(error)return toast(error.message,'error');await loadSchedules();toast('Agendamento excluído.','ok')};

async function loadPosts(){const{data,error}=await sb.from('post_logs').select('*').order('created_at',{ascending:false}).limit(100);if(error){renderDbError('postList','Postagens',error);return}state.posts=data||[];$('postCount').textContent=state.posts.length;$('postList').innerHTML=state.posts.map(p=>`<div class="tableRow"><div><b>${esc(p.provider)}</b><small>${fmtDate(p.created_at)}</small></div><span class="tag">${esc(p.status)}</span><span>${esc(p.external_id||'—')}</span><span>${esc(p.error_message||'')}</span></div>`).join('')||'<div class="empty">Nenhuma postagem registrada.</div>'}

async function loadIntegrations(){const{data,error}=await sb.from('integrations').select('provider,status,updated_at');if(error)return;state.integrations=data||[];for(const provider of ['shopee','mercadolivre','whatsapp']){const rec=state.integrations.find(x=>x.provider===provider);const text=rec?.status==='connected'?'Conectada':'Pendente';const ids=provider==='shopee'?['shopeeStatus','shopeeStatus2']:provider==='mercadolivre'?['mlStatus','mlStatus2']:['waStatus','waStatus2'];ids.forEach(id=>$(id).textContent=text)}}

async function mercadoLivreConnect(){
  if(!requireAccess())return;
  try{
    const {data:{session}}=await sb.auth.getSession();
    if(!session) return toast('Faça login novamente para conectar o Mercado Livre.','error');

    // A função mercadolivre-auth também inicia o OAuth quando chamada sem ?code=.
    const r=await fetch(`${SUPABASE_URL}/functions/v1/mercadolivre-auth`,{
      headers:{
        Authorization:`Bearer ${session.access_token}`,
        apikey:SUPABASE_ANON_KEY
      }
    });
    const data=await r.json().catch(()=>({}));

    const authorizationUrl = data.authorization_url || data.url;
    if(r.ok && authorizationUrl){
      location.href=authorizationUrl;
      return;
    }
    toast(data.error||data.message||'Não foi possível iniciar a autorização do Mercado Livre.','error');
  }catch(e){
    toast('Não foi possível iniciar a integração: '+e.message,'error');
  }
}

async function mercadoLivreStatus(showMessage=false){
  try{
    const {data:{session}}=await sb.auth.getSession();
    if(!session) return false;

    const r=await fetch(`${SUPABASE_URL}/functions/v1/mercadolivre-status`,{
      headers:{
        Authorization:`Bearer ${session.access_token}`,
        apikey:SUPABASE_ANON_KEY
      }
    });
    const data=await r.json().catch(()=>({}));
    const connected = r.ok && (data.connected===true || data.status==='connected');

    ['mlStatus','mlStatus2'].forEach(id=>{
      const el=$(id);
      if(el) el.textContent=connected?'Conectada':'Pendente';
    });

    if(showMessage){
      if(connected) toast('Mercado Livre conectado com sucesso.','ok');
      else toast(data.error||data.message||'Mercado Livre ainda não está conectado.','error');
    }
    return connected;
  }catch(e){
    if(showMessage) toast('Falha ao verificar Mercado Livre: '+e.message,'error');
    return false;
  }
}

document.querySelectorAll('.connectProvider').forEach(btn=>btn.onclick=async()=>{
  if(!requireAccess())return;
  const provider=btn.dataset.provider;

  if(provider==='mercadolivre'){
    await mercadoLivreConnect();
    return;
  }

  try{
    const{data:{session}}=await sb.auth.getSession();
    const r=await fetch(`${SUPABASE_URL}/functions/v1/oauth-start?provider=${encodeURIComponent(provider)}`,{
      headers:{Authorization:`Bearer ${session.access_token}`,apikey:SUPABASE_ANON_KEY}
    });
    const data=await r.json().catch(()=>({}));
    if(r.ok&&data.url)location.href=data.url;
    else toast(data.error||'Integração ainda não configurada no backend.','error');
  }catch(e){
    toast('Não foi possível iniciar a integração: '+e.message,'error');
  }
});

// Compatível com o botão "Verificar conexão" da V5, caso ele use um destes IDs/classes.
document.querySelectorAll('#mlCheckStatus,#verifyMlConnection,.verifyMlConnection,[data-ml-status]').forEach(btn=>{
  btn.onclick=()=>mercadoLivreStatus(true);
});

// Se voltarmos do OAuth do Mercado Livre, atualiza o status automaticamente.
if(new URLSearchParams(location.search).has('ml_connected')){
  mercadoLivreStatus(true);
}

document.querySelectorAll('.checkout').forEach(btn=>btn.onclick=async()=>{const old=btn.textContent;btn.disabled=true;btn.textContent='Preparando...';try{const{data:{session}}=await sb.auth.getSession();const r=await fetch(`${SUPABASE_URL}/functions/v1/create-checkout`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`,apikey:SUPABASE_ANON_KEY},body:JSON.stringify({plan:btn.dataset.plan,method:btn.dataset.method,return_url:location.href})});const data=await r.json().catch(()=>({}));if(r.ok&&data.checkout_url)location.href=data.checkout_url;else if(r.ok&&data.pix)toast('PIX gerado pelo gateway.','ok');else toast(data.error||'Gateway ainda não configurado. Veja o README V4.','error')}catch(e){toast('Checkout indisponível: '+e.message,'error')}finally{btn.disabled=false;btn.textContent=old}});

async function loadAdmin(){
  if(!isAdmin())return;
  const [{data:users,error:ue},{data:errors,error:ee},{count:postCount},{count:activeSubs}]=await Promise.all([
    sb.rpc('admin_list_users'),
    sb.from('error_logs').select('*').order('created_at',{ascending:false}).limit(50),
    sb.from('post_logs').select('*',{count:'exact',head:true}),
    sb.from('subscriptions').select('*',{count:'exact',head:true}).eq('status','active')
  ]);
  if(ue)return toast('Admin SQL incompleto: '+ue.message,'error');
  const arr=users||[];$('adminUsers').textContent=arr.length;$('adminActiveSubs').textContent=activeSubs||0;$('adminPosts').textContent=postCount||0;$('adminErrors').textContent=(errors||[]).length;
  $('adminUserList').innerHTML=arr.map(u=>`<div class="tableRow"><div><b>${esc(u.name||u.email)}</b><small>${esc(u.email)}</small></div><span class="tag">${esc(u.plan_code||'sem plano')}</span><span>${esc(u.subscription_status||'inactive')}</span><button class="secondary" onclick="adminToggle('${u.user_id}',${!u.is_blocked})">${u.is_blocked?'Liberar':'Bloquear'}</button></div>`).join('')||'<div class="empty">Nenhum usuário.</div>';
  if(ee)$('adminErrorList').innerHTML='<div class="empty">'+esc(ee.message)+'</div>';else $('adminErrorList').innerHTML=(errors||[]).map(e=>`<div class="tableRow"><div><b>${esc(e.source)}</b><small>${fmtDate(e.created_at)}</small></div><span>${esc(e.code||'—')}</span><span>${esc(e.message)}</span><span></span></div>`).join('')||'<div class="empty">Nenhum erro.</div>';
}
$('refreshAdmin').onclick=loadAdmin;
window.adminToggle=async(userId,blocked)=>{if(!isAdmin())return;const{error}=await sb.rpc('admin_set_user_blocked',{target_user:userId,blocked});if(error)return toast(error.message,'error');await loadAdmin();toast(blocked?'Usuário bloqueado.':'Usuário liberado.','ok')};

function renderDbError(id,label,error){const el=$(id);if(el)el.innerHTML=`<div class="empty">${esc(label)} indisponível: ${esc(error.message)}<br>Execute o arquivo supabase_v4.sql.</div>`}

sb.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'){state.user=null}if(event==='SIGNED_IN'&&session?.user&&!state.user)boot(session.user)});
(async()=>{const{data}=await sb.auth.getSession();if(data.session?.user)boot(data.session.user)})();
