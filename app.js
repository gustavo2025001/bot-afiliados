// BOT AFILIADOS PREMIUM
// Chave publishable/anon pode ficar no frontend quando o RLS está correto.
// NUNCA coloque service_role, OAuth secret ou segredo do gateway no GitHub.
const SUPABASE_URL='https://jhdezfnafhekimolfiuu.supabase.co';
const SUPABASE_ANON_KEY='sb_publishable_lAfLqmLZ0rp9UZHATVXtyg_4Wmsn18i';
const sb=supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
const $=id=>document.getElementById(id);
const state={user:null,profile:null,subscription:null,products:[],campaigns:[],schedules:[],posts:[],integrations:[],whatsapp:{connected:false,verified_name:null,phone_mask:null,has_default_recipient:false},share:{used:0,limit:null,unlimited:false,allowed:false,plan:null},previewId:null};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const fmtDate=v=>v?new Date(v).toLocaleString('pt-BR'):'—';
const toast=(text,type='')=>{const el=$('toast');el.textContent=text;el.className='toast '+type;clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.add('hidden'),4200)};
const modal=id=>$(id)?.classList.remove('hidden');
const closeModal=id=>$(id)?.classList.add('hidden');
const ADMIN_EMAIL='gustavodepaulabarbosag@gmail.com';
const ADMIN_USER_ID='b1fa7a00-02fe-4c7c-b2a5-3873eee3f5d1';

const isAdmin=()=>{
  const email=String(state.user?.email||'').trim().toLowerCase();
  const userId=String(state.user?.id||'').trim();

  return userId===ADMIN_USER_ID || email===ADMIN_EMAIL;
};
const subscriptionActive=()=>!!state.subscription&&state.subscription.status==='active'&&(!state.subscription.current_period_end||new Date(state.subscription.current_period_end)>new Date());
const hasAccess=()=>isAdmin()||subscriptionActive();

function tabs(w){$('signupView').classList.toggle('hidden',w!=='signup');$('loginView').classList.toggle('hidden',w!=='login');$('signupTab').classList.toggle('active',w==='signup');$('loginTab').classList.toggle('active',w==='login');$('msg').textContent=''}
$('signupTab').onclick=()=>tabs('signup'); $('loginTab').onclick=()=>tabs('login'); $('backLogin').onclick=()=>{$('verifyCard').classList.add('hidden');$('authCard').classList.remove('hidden');tabs('login')};
function passwordOK(p){return p.length>=8&&/[A-Z]/.test(p)&&/[0-9]/.test(p)&&/[^A-Za-z0-9]/.test(p)}
$('signupPassword').oninput=e=>{const p=e.target.value,c=[p.length>=8,/[A-Z]/.test(p),/[0-9]/.test(p),/[^A-Za-z0-9]/.test(p)];c.forEach((x,i)=>$('r'+(i+1)).classList.toggle('ok',x));const n=c.filter(Boolean).length;$('strengthBar').style.width=n*25+'%';$('strengthText').textContent=n<2?'Fraca':n<4?'Média':'Forte'};
$('signupBtn').onclick=async()=>{const name=$('name').value.trim(),email=$('signupEmail').value.trim(),phone=$('phone').value.trim(),p=$('signupPassword').value;if(!name||!email||!phone||!p)return $('msg').textContent='Preencha todos os campos.';if(phone!==$('phone2').value.trim())return $('msg').textContent='Os telefones não conferem.';if(p!==$('password2').value)return $('msg').textContent='As senhas não conferem.';if(!passwordOK(p))return $('msg').textContent='A senha ainda não atende às regras.';if(!$('terms').checked)return $('msg').textContent='Aceite os termos.';$('msg').textContent='Criando conta...';const{data,error}=await sb.auth.signUp({email,password:p,options:{data:{name,phone},emailRedirectTo:location.origin+location.pathname}});if(error)return $('msg').textContent=error.message;if(data.session)return boot(data.user);$('verifyEmail').textContent=email;$('authCard').classList.add('hidden');$('verifyCard').classList.remove('hidden')};
$('loginBtn').onclick=async()=>{const{data,error}=await sb.auth.signInWithPassword({email:$('loginEmail').value.trim(),password:$('loginPassword').value});if(error)return $('msg').textContent=error.message;boot(data.user)};
$('forgotBtn').onclick=async()=>{const email=$('loginEmail').value.trim();if(!email)return $('msg').textContent='Digite seu e-mail primeiro.';const{error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});$('msg').textContent=error?error.message:'Link de recuperação enviado.'};
$('logoutBtn').onclick=async()=>{await sb.auth.signOut();location.reload()};

async function boot(user){
  state.user=user;
  $('authShell').classList.add('hidden');
  $('panel').classList.remove('hidden');

  const n=user.user_metadata?.name||user.email?.split('@')[0]||'Usuário';
  $('welcome').textContent=n+' 👋';
  $('sideName').textContent=n;

  // Segurança visual: começa escondendo tudo que é exclusivo do Admin.
  document.querySelectorAll('.adminOnly').forEach(x=>x.classList.add('hidden'));

  await loadAccount();
  enforceGate();

  // Somente o e-mail administrador pode enxergar a Área Admin.
  if(isAdmin()){
    document.querySelectorAll('.adminOnly').forEach(x=>x.classList.remove('hidden'));
  }else{
    // Se uma conta comum estiver numa tela admin por qualquer motivo, volta ao Dashboard.
    if($('view-admin')?.classList.contains('active')) showView('dashboard');
  }

  await Promise.all([
    loadProducts(),
    loadCampaigns(),
    loadSchedules(),
    loadPosts(),
    loadIntegrations(),
    loadShareStatus()
  ]);

  // Inicia a escuta em tempo real somente depois da carga inicial.
  startProductsRealtime();

  if(isAdmin()) await loadAdmin();
  renderAll();
}
async function loadAccount(){const[{data:profile,error:pe},{data:sub}]=await Promise.all([sb.from('profiles').select('*').eq('id',state.user.id).maybeSingle(),sb.from('subscriptions').select('*').eq('user_id',state.user.id).order('created_at',{ascending:false}).limit(1).maybeSingle()]);if(pe)toast('Execute o SQL atualizado no Supabase: '+pe.message,'error');state.profile=profile;state.subscription=sub}
function enforceGate(){
  const active=hasAccess();
  $('subscriptionGate')?.classList.toggle('hidden',active);
  document.querySelectorAll('.protected').forEach(el=>el.classList.toggle('locked',!active));
  document.querySelectorAll('.protectedAction').forEach(el=>el.disabled=!active);
  const plan=isAdmin()?'ADMIN':(state.subscription?.plan_code?.toUpperCase()||'SEM PLANO');

  const planBadge=$('planBadge');
  if(planBadge){
    planBadge.textContent=plan;
    planBadge.className='badge '+(active?'success':'warning');
  }

  const accountStatus=$('accountStatus');
  if(accountStatus) accountStatus.textContent=active?'● Conta liberada':'● Acesso limitado';

  const planCardName=$('planCardName');
  if(planCardName) planCardName.textContent=plan;

  const planCardStatus=$('planCardStatus');
  if(planCardStatus) planCardStatus.textContent=active?'Acesso liberado':'Acesso limitado';

  const planExpiry=$('planExpiry');
  if(planExpiry){
    planExpiry.textContent=state.subscription?.current_period_end
      ? 'Assinatura até '+new Date(state.subscription.current_period_end).toLocaleDateString('pt-BR')
      : isAdmin()?'Administrador':'Sem assinatura';
  }

  const automationStatus=$('automationStatus');
  if(automationStatus) automationStatus.textContent=active?'Pronta para uso':'Bloqueada';
}
function requireAccess(){if(hasAccess())return true;toast('Assinatura ativa necessária.','error');showView('plans');return false}
function showView(name){if(['offers','products','queue','campaigns','schedules','integrations','channels','reports'].includes(name)&&!requireAccess())return;if(name==='admin'&&!isAdmin())return toast('Acesso administrativo negado.','error');document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));$('view-'+name)?.classList.add('active');document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.view===name));if(name==='queue')renderQueue();if(name==='offers')renderOffers()}
document.querySelectorAll('.nav').forEach(btn=>btn.onclick=()=>showView(btn.dataset.view));document.querySelectorAll('[data-view-jump]').forEach(btn=>btn.onclick=()=>showView(btn.dataset.viewJump));document.querySelectorAll('[data-open-plans]').forEach(btn=>btn.onclick=()=>showView('plans'));document.querySelectorAll('.closeModal').forEach(btn=>btn.onclick=()=>closeModal(btn.dataset.modal));

async function loadShareStatus(){const{data,error}=await sb.rpc('get_share_status');if(error){state.share={used:0,limit:null,unlimited:isAdmin(),allowed:hasAccess(),plan:isAdmin()?'admin':null};return}const r=Array.isArray(data)?data[0]:data;if(r)state.share={used:Number(r.used||0),limit:r.daily_limit==null?null:Number(r.daily_limit),unlimited:!!r.unlimited,allowed:!!r.allowed,plan:r.plan_code};renderUsage()}
function renderUsage(){
  const s=state.share;
  const label=s.unlimited?`${s.used} / ILIMITADO`:`${s.used} / ${s.limit??'—'}`;
  const daily=$('dailyUsage'); if(daily)daily.textContent=label;
  const today=$('todayPostCount'); if(today)today.textContent=s.used;
  const pct=s.unlimited?Math.min(s.used,100):s.limit?Math.min(100,(s.used/s.limit)*100):0;
  const bar=$('usageBar'); if(bar)bar.style.width=pct+'%';
  const help=$('planCardHelp');
  if(help)help.textContent=s.unlimited?'Compartilhamentos ilimitados por dia.':s.limit?`Limite diário: ${s.limit}. Reinicia no dia seguinte.`:'Escolha um plano para liberar as funções.';
}

function parseOfferText(text){const url=(text.match(/https?:\/\/\S+/)||[])[0]?.replace(/[),.!]+$/,'');if(!url)return null;const priceMatch=text.match(/(?:por|agora|de)\s+(R\$\s?[\d.,]+)/i)||text.match(/(R\$\s?[\d.,]+)/i);const nums=[...text.matchAll(/R\$\s?([\d.,]+)/gi)].map(m=>Number(m[1].replace(/\./g,'').replace(',','.'))).filter(Number.isFinite);const current=nums.length?nums[nums.length-1]:0,old=nums.length>1?nums[0]:0;const title=text.replace(url,'').replace(/^Dê uma olhada em\s*/i,'').split(/\s+(?:por|de)\s+R\$/i)[0].trim();return{title:title||'Oferta importada',price:current,old_price:old>current?old:0,discount_percent:old>current?Math.round((1-current/old)*100):0,affiliate_url:url,platform:/mercadolivre|mercadolivre\.com/i.test(url)?'mercadolivre':'shopee'}}
$('parseOffer').onclick=()=>{const p=parseOfferText($('pPaste').value);if(!p)return toast('Não encontrei um link válido no texto.','error');$('pTitle').value=p.title;$('pPrice').value=String(p.price||'').replace('.',',');$('pOldPrice').value=String(p.old_price||'').replace('.',',');$('pDiscount').value=p.discount_percent||'';$('pLink').value=p.affiliate_url;$('pPlatform').value=p.platform;toast('Oferta lida. Confira os dados e salve.','ok')};
$('newProduct').onclick=$('newProduct2').onclick=$('quickProduct').onclick=$('newOffer').onclick=()=>{if(!requireAccess())return;clearProductForm();modal('productModal')};
function clearProductForm(){['pPaste','pTitle','pPrice','pOldPrice','pDiscount','pLink','pImage','pCategory'].forEach(id=>{if($(id))$(id).value=''});$('pCategory').value='Geral';$('pMsg').textContent=''}

async function loadProducts(){const{data,error}=await sb.from('products').select('*').order('created_at',{ascending:false});if(error){renderDbError('productList','Produtos',error);return}state.products=data||[];renderProducts();renderOffers();renderQueue()}

// Realtime: atualiza Produtos/Ofertas/Fila automaticamente quando a tabela products mudar.
let productsRealtimeChannel = null;
let productsRealtimeTimer = null;

function startProductsRealtime(){
  if(!state.user?.id)return;

  // Evita listeners duplicados caso o boot seja executado novamente.
  if(productsRealtimeChannel){
    sb.removeChannel(productsRealtimeChannel);
    productsRealtimeChannel=null;
  }

  productsRealtimeChannel=sb
    .channel(`products-realtime-${state.user.id}`)
    .on(
      'postgres_changes',
      {
        event:'*',
        schema:'public',
        table:'products',
        filter:`user_id=eq.${state.user.id}`
      },
      ()=>{
        // O sync pode alterar varias ofertas juntas; agrupamos os eventos em uma recarga.
        clearTimeout(productsRealtimeTimer);
        productsRealtimeTimer=setTimeout(async()=>{
          console.log('Produtos atualizados automaticamente pelo Realtime.');
          await loadProducts();
        },500);
      }
    )
    .subscribe(status=>{
      console.log('Products Realtime:',status);
    });
}

function renderAll(){renderProducts();renderOffers();renderQueue();renderCampaigns();renderSchedules();renderPosts();renderUsage();renderBotV51()}
function renderProducts(){if(!$('productList'))return;$('offerCount').textContent=state.products.length;$('queueCount').textContent=state.products.filter(x=>x.queued).length;$('productList').innerHTML=state.products.map(p=>`<div class="tableRow"><div><b>${esc(p.title)}</b><small>${esc(p.affiliate_url)}</small></div><span class="tag">${esc(p.platform)}</span><span>${money(p.price)}</span><div class="rowActions"><button class="iconBtn" onclick="queueProduct('${p.id}',${!p.queued})">${p.queued?'✓ Fila':'+ Fila'}</button><button class="dangerBtn" onclick="deleteProduct('${p.id}')">Excluir</button></div></div>`).join('')||'<div class="empty">Nenhum produto cadastrado.</div>';const mini=state.products.slice(0,5);$('offerListMini').innerHTML=mini.map(p=>`<div class="miniOffer"><div class="miniThumb">${p.image_url?`<img src="${esc(p.image_url)}" alt="">`:'🛍'}</div><div><b>${esc(p.title)}</b><small>${money(p.price)} • ${esc(p.platform)}</small></div><span class="tag">${p.discount_percent?'-'+p.discount_percent+'%':'OFERTA'}</span></div>`).join('')||'<div class="empty">Nenhuma oferta ainda.</div>'}
function filteredOffers(){const q=($('offerSearch')?.value||'').toLowerCase(),plat=$('offerPlatform')?.value||'all',f=$('offerFilter')?.value||'all';return state.products.filter(p=>(!q||[p.title,p.category,p.platform].join(' ').toLowerCase().includes(q))&&(plat==='all'||p.platform===plat)&&(f==='all'||f==='queue'&&p.queued||f==='favorite'&&p.favorite))}
function renderOffers(){if(!$('offerGrid'))return;const list=filteredOffers();$('offerGrid').innerHTML=list.map(p=>`<article class="offerCard"><div class="offerImage">${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.title)}" loading="lazy">`:'🛍️'}</div><div class="offerBody"><div class="offerTop"><span class="platformTag">${esc(p.platform).toUpperCase()}</span>${p.discount_percent?`<span class="discountTag">-${p.discount_percent}%</span>`:''}</div><h3>${esc(p.title)}</h3>${Number(p.old_price)>Number(p.price)?`<div class="oldPrice">${money(p.old_price)}</div>`:''}<div class="price">${money(p.price)}</div><div class="offerActions"><button class="${p.queued?'queueActive':''}" onclick="queueProduct('${p.id}',${!p.queued})">${p.queued?'✓ Na fila':'+ Fila'}</button><button onclick="favoriteProduct('${p.id}',${!p.favorite})">${p.favorite?'♥ Favorito':'♡ Favoritar'}</button><button onclick="selectPreview('${p.id}')">👁 Prévia</button><button onclick="shareWhatsApp('${p.id}')">🟢 WhatsApp</button></div></div></article>`).join('')||'<div class="empty">Nenhuma oferta encontrada.</div>'}
['offerSearch','offerPlatform','offerFilter'].forEach(id=>$(id)?.addEventListener(id==='offerSearch'?'input':'change',renderOffers));
$('saveProduct').onclick=async()=>{if(!requireAccess())return;const title=$('pTitle').value.trim(),link=$('pLink').value.trim();if(!title||!link)return $('pMsg').textContent='Preencha título e link.';$('pMsg').textContent='Salvando...';const num=id=>Number(String($(id).value||'0').replace(/\./g,'').replace(',','.'))||0;const payload={user_id:state.user.id,title,price:num('pPrice'),old_price:num('pOldPrice'),discount_percent:Number($('pDiscount').value)||0,platform:$('pPlatform').value,affiliate_url:link,image_url:$('pImage').value.trim()||null,category:$('pCategory').value.trim()||'Geral',source:'manual'};const{error}=await sb.from('products').insert(payload);if(error)return $('pMsg').textContent=error.message;closeModal('productModal');await loadProducts();toast('Oferta salva no Supabase.','ok')};
window.deleteProduct=async id=>{if(!requireAccess())return;if(!confirm('Excluir este produto?'))return;const{error}=await sb.from('products').delete().eq('id',id);if(error)return toast(error.message,'error');await loadProducts();toast('Produto excluído.','ok')};
window.queueProduct=async(id,on)=>{if(!requireAccess())return;const{error}=await sb.rpc('toggle_product_queue',{target_product:id,put_in_queue:on});if(error)return toast(error.message,'error');const p=state.products.find(x=>x.id===id);if(p)p.queued=on;renderProducts();renderOffers();renderQueue()};
window.favoriteProduct=async(id,on)=>{const{error}=await sb.rpc('toggle_product_favorite',{target_product:id,make_favorite:on});if(error)return toast(error.message,'error');const p=state.products.find(x=>x.id===id);if(p)p.favorite=on;renderOffers()};

function adMessage(p){const old=Number(p.old_price)>Number(p.price)?`💸 De: ${money(p.old_price)}\n`:'';const disc=p.discount_percent?`🔥 ${p.discount_percent}% OFF\n`:'';return `🔥 OFERTA ${String(p.platform||'').toUpperCase()} 🔥\n\n🛍️ ${p.title}\n${old}💰 Por: ${money(p.price)}\n${disc}\n🛒 Confira agora:\n${p.affiliate_url}`}
window.selectPreview=id=>{state.previewId=id;renderPreview();showView('queue')};
function renderQueue(){if(!$('queueList'))return;const q=state.products.filter(x=>x.queued);$('queueCount').textContent=q.length;$('queueList').innerHTML=q.map((p,i)=>`<div class="tableRow"><div><b>${String(i+1).padStart(2,'0')} • ${esc(p.title)}</b><small>${esc(p.platform)} • ${money(p.price)}</small></div><span class="tag">NA FILA</span><span>${p.discount_percent?'-'+p.discount_percent+'%':'Oferta'}</span><div class="rowActions"><button class="iconBtn" onclick="selectPreview('${p.id}')">Prévia</button><button class="dangerBtn" onclick="queueProduct('${p.id}',false)">Remover</button></div></div>`).join('')||'<div class="empty">Fila vazia. Adicione ofertas na página Ofertas.</div>';if(!state.previewId&&q[0])state.previewId=q[0].id;if(state.previewId&&!state.products.some(x=>x.id===state.previewId))state.previewId=q[0]?.id||null;renderPreview()}
function renderPreview(){const p=state.products.find(x=>x.id===state.previewId);if(!p){$('previewTitle').textContent='Selecione uma oferta';$('previewImage').innerHTML='🛍';$('previewMessage').textContent='A mensagem aparecerá aqui.';$('previewWhatsApp').disabled=true;$('previewCopy').disabled=true;return}$('previewTitle').textContent=p.title;$('previewImage').innerHTML=p.image_url?`<img src="${esc(p.image_url)}" alt="">`:'🛍';$('previewMessage').textContent=adMessage(p);$('previewWhatsApp').disabled=false;$('previewCopy').disabled=false}
$('previewCopy').onclick=async()=>{const p=state.products.find(x=>x.id===state.previewId);if(!p)return;await navigator.clipboard.writeText(adMessage(p));toast('Mensagem copiada.','ok')};
$('previewWhatsApp').onclick=()=>state.previewId&&shareWhatsApp(state.previewId);$('shareNext').onclick=()=>{const p=state.products.find(x=>x.queued);if(!p)return toast('A fila está vazia.','error');shareWhatsApp(p.id)};
window.shareWhatsApp=async id=>{
  if(!requireAccess())return;
  const p=state.products.find(x=>x.id===id);
  if(!p)return;

  // Se a Cloud API estiver conectada, envia de verdade pelo backend, sem abrir o WhatsApp.
  if(state.whatsapp.connected){
    try{
      const{data:{session}}=await sb.auth.getSession();
      if(!session?.access_token)throw new Error('Sessão expirada. Faça login novamente.');
      toast('Enviando pela WhatsApp Cloud API...');
      const r=await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-send-product`,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`,'apikey':SUPABASE_ANON_KEY},
        body:JSON.stringify({product_id:id,message:adMessage(p)})
      });
      const d=await r.json().catch(()=>({}));
      if(!r.ok||d.success!==true)throw new Error(d.error||`Erro HTTP ${r.status}`);
      p.queued=false;
      await Promise.all([loadShareStatus(),loadPosts(),loadProducts()]);
      renderProducts();renderOffers();renderQueue();
      toast(`Mensagem enviada pela API para ${d.to_mask||'o destinatário configurado'}.`,'ok');
      return;
    }catch(e){
      await Promise.all([loadShareStatus(),loadPosts()]);
      toast('Falha no envio pela API: '+e.message,'error');
      return;
    }
  }

  // Fallback seguro: mantém exatamente o compartilhamento assistido que já existia.
  const popup=window.open('about:blank','_blank');
  const{error}=await sb.rpc('record_assisted_share',{target_product:id,target_provider:'whatsapp'});
  if(error){popup?.close();toast(error.message.includes('Limite')?'Você atingiu o limite de hoje. Amanhã o contador reinicia.':error.message,'error');await loadShareStatus();return}
  if(popup)popup.location.href='https://wa.me/?text='+encodeURIComponent(adMessage(p));else window.location.href='https://wa.me/?text='+encodeURIComponent(adMessage(p));
  p.queued=false;
  await Promise.all([loadShareStatus(),loadPosts()]);
  renderProducts();renderOffers();renderQueue();
  toast('Compartilhamento registrado no uso diário.','ok');
};

async function syncOffers(){if(!requireAccess())return;const btns=[$('syncOffers'),$('syncOffers2')].filter(Boolean);btns.forEach(b=>{b.disabled=true;b.textContent='Buscando...'});try{const{data:{session}}=await sb.auth.getSession();const r=await fetch(`${SUPABASE_URL}/functions/v1/fetch-offers`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`,apikey:SUPABASE_ANON_KEY},body:JSON.stringify({providers:['shopee','mercadolivre']})});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Integração de ofertas ainda não configurada.');if(data.imported)toast(`${data.imported} oferta(s) importada(s).`,'ok');await loadProducts()}catch(e){toast(e.message+' Você ainda pode adicionar ofertas manualmente.','error')}finally{btns.forEach((b,i)=>{b.disabled=false;b.textContent=i?'↻ Buscar ofertas':'↻ Buscar ofertas'})}}
$('syncOffers').onclick=syncOffers;$('syncOffers2').onclick=syncOffers;

function fillCampaignProducts(){$('cProduct').innerHTML='<option value="">Sem produto</option>'+state.products.map(p=>`<option value="${p.id}">${esc(p.title)}</option>`).join('')}
$('newCampaign').onclick=()=>{if(!requireAccess())return;fillCampaignProducts();modal('campaignModal')};$('cProduct').onchange=()=>{const p=state.products.find(x=>x.id===$('cProduct').value);if(p&&!$('cMessage').value.trim())$('cMessage').value=adMessage(p)};
async function loadCampaigns(){const{data,error}=await sb.from('campaigns').select('*,products(title)').order('created_at',{ascending:false});if(error){renderDbError('campaignList','Campanhas',error);return}state.campaigns=data||[];renderCampaigns()}
function renderCampaigns(){
  const list=$('campaignList');
  if(!list)return;
  const count=$('campaignCount');
  if(count)count.textContent=state.campaigns.length;
  list.innerHTML=state.campaigns.map(c=>`<div class="tableRow"><div><b>${esc(c.name)}</b><small>${esc(c.products?.title||'Sem produto')}</small></div><span>${esc((c.channels||[]).join(', '))}</span><span class="tag">${esc(c.status)}</span><button class="dangerBtn" onclick="deleteCampaign('${c.id}')">Excluir</button></div>`).join('')||'<div class="empty">Nenhuma campanha criada.</div>';
}
$('saveCampaign').onclick=async()=>{if(!requireAccess())return;const name=$('cName').value.trim(),message=$('cMessage').value.trim(),channels=[...document.querySelectorAll('input[name="channel"]:checked')].map(x=>x.value);if(!name||!message||!channels.length)return $('cMsg').textContent='Informe nome, mensagem e ao menos um canal.';const{error}=await sb.from('campaigns').insert({user_id:state.user.id,name,product_id:$('cProduct').value||null,message,channels,status:'ready'});if(error)return $('cMsg').textContent=error.message;$('cName').value=$('cMessage').value='';document.querySelectorAll('input[name="channel"]').forEach(x=>x.checked=false);closeModal('campaignModal');await loadCampaigns();toast('Campanha criada.','ok')};
window.deleteCampaign=async id=>{if(!confirm('Excluir esta campanha?'))return;const{error}=await sb.from('campaigns').delete().eq('id',id);if(error)return toast(error.message,'error');await Promise.all([loadCampaigns(),loadSchedules()])};

function fillScheduleCampaigns(){$('sCampaign').innerHTML=state.campaigns.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')||'<option value="">Crie uma campanha primeiro</option>'}
$('newSchedule').onclick=()=>{if(!requireAccess())return;fillScheduleCampaigns();modal('scheduleModal')};
async function loadSchedules(){const{data,error}=await sb.from('schedules').select('*,campaigns(name)').order('scheduled_for',{ascending:true});if(error){renderDbError('scheduleList','Agendamentos',error);return}state.schedules=data||[];renderSchedules()}
function renderSchedules(){
  const list=$('scheduleList');
  if(!list)return;
  const pending=state.schedules.filter(s=>s.status==='pending');
  const count=$('scheduleCount');
  if(count)count.textContent=pending.length;
  list.innerHTML=state.schedules.map(s=>`<div class="tableRow"><div><b>${esc(s.campaigns?.name||'Campanha')}</b><small>${fmtDate(s.scheduled_for)}</small></div><span class="tag">${esc(s.status)}</span><span>${esc(s.timezone||'America/Sao_Paulo')}</span><button class="dangerBtn" onclick="deleteSchedule('${s.id}')">Excluir</button></div>`).join('')||'<div class="empty">Nenhum agendamento.</div>';
  const mini=$('scheduleListMini');
  if(mini)mini.innerHTML=pending.slice(0,5).map(s=>`<div class="miniOffer"><div class="miniThumb">◷</div><div><b>${esc(s.campaigns?.name||'Campanha')}</b><small>${fmtDate(s.scheduled_for)}</small></div><span class="tag">PENDENTE</span></div>`).join('')||'<div class="empty">Nenhum agendamento.</div>';
}
$('saveSchedule').onclick=async()=>{if(!requireAccess())return;const campaign_id=$('sCampaign').value,when=$('sWhen').value;if(!campaign_id||!when)return $('sMsg').textContent='Selecione a campanha e a data.';const d=new Date(when);if(d<=new Date())return $('sMsg').textContent='Escolha uma data futura.';const{error}=await sb.from('schedules').insert({user_id:state.user.id,campaign_id,scheduled_for:d.toISOString(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'America/Sao_Paulo',status:'pending'});if(error)return $('sMsg').textContent=error.message;closeModal('scheduleModal');$('sWhen').value='';await loadSchedules();toast('Agendamento criado.','ok')};
window.deleteSchedule=async id=>{if(!confirm('Excluir este agendamento?'))return;const{error}=await sb.from('schedules').delete().eq('id',id);if(error)return toast(error.message,'error');await loadSchedules()};

async function loadPosts(){const{data,error}=await sb.from('post_logs').select('*').order('created_at',{ascending:false}).limit(100);if(error){renderDbError('postList','Histórico',error);return}state.posts=data||[];renderPosts()}
function renderPosts(){if(!$('postList'))return;$('postList').innerHTML=state.posts.map(p=>`<div class="tableRow"><div><b>${esc(p.provider)}</b><small>${fmtDate(p.created_at)}</small></div><span class="tag">${esc(p.status)}</span><span>${esc(p.response_meta?.title||p.external_id||'—')}</span><span>${esc(p.error_message||'')}</span></div>`).join('')||'<div class="empty">Nenhum compartilhamento registrado.</div>'}
async function loadIntegrations(){
  const {data,error}=await sb.from('integrations').select('provider,status,updated_at');
  state.integrations=error?[]:(data||[]);

  // IMPORTANTE: nenhuma integracao e herdada do navegador ou de outro usuario.
  // Cada status precisa vir do backend/banco vinculado ao user_id da sessao atual.

  // SHOPEE: somente fica conectada quando ESTE usuario tiver credenciais validadas.
  let shopeeConnected=false;
  try{
    const {data:shopeeRow,error:shopeeError}=await sb
      .from('shopee_integrations')
      .select('connected,status,app_id,updated_at')
      .eq('user_id',state.user.id)
      .maybeSingle();

    if(shopeeError) console.warn('Falha ao consultar shopee_integrations:',shopeeError);
    shopeeConnected=!!shopeeRow && !!shopeeRow.app_id && shopeeRow.connected===true && shopeeRow.status==='connected';
  }catch(e){
    console.warn('Falha ao consultar status da Shopee:',e);
    shopeeConnected=false;
  }

  ['shopeeStatus','shopeeStatus2'].forEach(id=>{
    const el=$(id);
    if(el){
      el.textContent=shopeeConnected?'Conectada':'Pendente';
      el.classList.toggle('connectedStatus',shopeeConnected);
    }
  });

  document.querySelectorAll('.connectProvider[data-provider="shopee"]').forEach(btn=>{
    btn.textContent=shopeeConnected?'Conectada ✓':'Conectar';
    btn.disabled=shopeeConnected;
  });
  const dashShopee=$('dashShopeeStatus');
  if(dashShopee)dashShopee.textContent=shopeeConnected?'Conectada':'Pendente';

  // WHATSAPP CLOUD API: o status real vem da Edge Function e nunca expõe o token.
  let waConnected=false;
  try{
    const {data:{session}}=await sb.auth.getSession();
    if(session?.access_token){
      const r=await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-status?t=${Date.now()}`,{
        method:'GET',
        cache:'no-store',
        headers:{'Accept':'application/json','Authorization':`Bearer ${session.access_token}`,'apikey':SUPABASE_ANON_KEY}
      });
      const d=await r.json().catch(()=>({}));
      waConnected=r.ok&&d.connected===true;
      state.whatsapp={connected:waConnected,verified_name:d.verified_name||null,phone_mask:d.phone_mask||null,has_default_recipient:!!d.has_default_recipient};
    }
  }catch(e){
    console.warn('Falha ao consultar whatsapp-status:',e);
    state.whatsapp={connected:false,verified_name:null,phone_mask:null,has_default_recipient:false};
  }
  ['waStatus','waStatus2'].forEach(id=>{
    const el=$(id);
    if(el){el.textContent=waConnected?'Conectada':'Pendente';el.classList.toggle('connectedStatus',waConnected);}
  });
  const dashWa=$('dashWaStatus');
  if(dashWa)dashWa.textContent=waConnected?'Conectado':'Pendente';
  const dashWaFallback=document.querySelector('#view-dashboard .integrationRows div:nth-child(3) b');
  if(dashWaFallback)dashWaFallback.textContent=waConnected?'Conectado':'Pendente';
  document.querySelectorAll('.connectProvider[data-provider="whatsapp"]').forEach(btn=>{
    btn.textContent=waConnected?'Gerenciar API':'Conectar API';
    btn.disabled=false;
  });

  // MERCADO LIVRE: o retorno OAuth apenas avisa que devemos consultar o backend.
  // Nao marcamos conectado por query string nem localStorage.
  const params=new URLSearchParams(location.search);
  const returnedFromMl=params.get('ml')==='connected';
  if(returnedFromMl){
    params.delete('ml');
    const qs=params.toString();
    history.replaceState({},'',location.pathname+(qs?'?'+qs:'')+location.hash);
  }

  let mlConnected=false;
  try{
    const {data:{session}}=await sb.auth.getSession();
    if(!session?.access_token) throw new Error('Sessao ausente');

    const statusUrl=`${SUPABASE_URL}/functions/v1/mercadolivre-status?t=${Date.now()}`;
    const r=await fetch(statusUrl,{
      method:'GET',
      cache:'no-store',
      headers:{
        'Accept':'application/json',
        'Authorization':`Bearer ${session.access_token}`,
        'apikey':SUPABASE_ANON_KEY
      }
    });
    const d=await r.json().catch(()=>({}));
    console.log('Mercado Livre status do usuario atual:',r.status,d);

    mlConnected=r.ok && (d.connected===true || d.status==='connected');
    if(returnedFromMl && mlConnected) toast('Mercado Livre conectado com sucesso!','ok');
  }catch(e){
    console.warn('Falha ao consultar mercadolivre-status:',e);
    mlConnected=false;
  }

  ['mlStatus','mlStatus2'].forEach(id=>{
    if($(id)){
      $(id).textContent=mlConnected?'Conectada':'Pendente';
      $(id).classList.toggle('connectedStatus',mlConnected);
    }
  });
  const dashMl=$('dashMlStatus');
  if(dashMl)dashMl.textContent=mlConnected?'Conectado':'Pendente';
}
document.querySelectorAll('.connectProvider').forEach(btn=>btn.onclick=async()=>{
  if(!requireAccess())return;
  const provider=btn.dataset.provider;

  if(provider==='shopee'){
    $('shopeeAppId').value='';
    $('shopeeSecret').value='';
    $('shopeeConnectMsg').textContent='';
    modal('shopeeConnectModal');
    return;
  }

  if(provider==='whatsapp'){
    $('waWabaId').value='';
    $('waPhoneNumberId').value='';
    $('waAccessToken').value='';
    $('waDefaultRecipient').value='';
    $('waConnectMsg').textContent=state.whatsapp.connected
      ? `Conectada${state.whatsapp.verified_name?' como '+state.whatsapp.verified_name:''}${state.whatsapp.phone_mask?' • '+state.whatsapp.phone_mask:''}. Para trocar as credenciais, preencha os campos novamente.`
      : 'Informe os dados da Meta. O token será enviado somente ao backend e armazenado criptografado.';
    $('waTestArea').classList.toggle('hidden',!state.whatsapp.connected);
    modal('whatsappConnectModal');
    return;
  }

  try{
    const{data:{session}}=await sb.auth.getSession();
    if(!session)throw new Error('Sessão expirada. Faça login novamente.');
    const endpoint=provider==='mercadolivre'?'mercadolivre-auth':`auth-start?provider=${encodeURIComponent(provider)}`;
    const r=await fetch(`${SUPABASE_URL}/functions/v1/${endpoint}`,{
      method:'GET',
      headers:{Authorization:`Bearer ${session.access_token}`,apikey:SUPABASE_ANON_KEY}
    });
    const data=await r.json().catch(()=>({}));
    const url=data.authorization_url||data.url;
    if(r.ok&&url){location.href=url;return;}
    toast(data.error||'Integração ainda não configurada no backend.','error');
  }catch(e){
    toast('Não foi possível iniciar a integração: '+e.message,'error');
  }
});


if($('saveWhatsAppConnect'))$('saveWhatsAppConnect').onclick=async()=>{
  if(!requireAccess())return;
  const waba_id=$('waWabaId').value.trim();
  const phone_number_id=$('waPhoneNumberId').value.trim();
  const access_token=$('waAccessToken').value.trim();
  const default_recipient=$('waDefaultRecipient').value.trim();
  const msg=$('waConnectMsg');
  const btn=$('saveWhatsAppConnect');
  if(!waba_id||!phone_number_id||!access_token){msg.textContent='Preencha WABA ID, Phone Number ID e Access Token.';return;}
  const old=btn.textContent;btn.disabled=true;btn.textContent='Validando com a Meta...';msg.textContent='Validando a conta e o número na Meta...';
  try{
    const{data:{session}}=await sb.auth.getSession();
    if(!session?.access_token)throw new Error('Sessão expirada. Faça login novamente.');
    const r=await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-connect`,{
      method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`,'apikey':SUPABASE_ANON_KEY},
      body:JSON.stringify({waba_id,phone_number_id,access_token,default_recipient})
    });
    const d=await r.json().catch(()=>({}));
    if(!r.ok||d.connected!==true)throw new Error(d.details||d.error||`Erro HTTP ${r.status}`);
    $('waAccessToken').value='';
    msg.textContent=`✅ Conectada${d.verified_name?' como '+d.verified_name:''}${d.phone_mask?' • '+d.phone_mask:''}.`;
    $('waTestArea').classList.remove('hidden');
    await loadIntegrations();
    toast('WhatsApp Cloud API conectada com sucesso!','ok');
  }catch(e){msg.textContent='❌ '+e.message;toast('Não foi possível conectar o WhatsApp.','error');}
  finally{btn.disabled=false;btn.textContent=old;}
};

if($('sendWhatsAppTest'))$('sendWhatsAppTest').onclick=async()=>{
  const to=$('waTestRecipient').value.trim();
  const message=$('waTestMessage').value.trim()||'Olá! Esta é uma mensagem de teste do Bot Afiliados Premium. ✅';
  const msg=$('waTestMsg');const btn=$('sendWhatsAppTest');const old=btn.textContent;
  btn.disabled=true;btn.textContent='Enviando...';msg.textContent='Enviando pela Cloud API...';
  try{
    const{data:{session}}=await sb.auth.getSession();
    if(!session?.access_token)throw new Error('Sessão expirada. Faça login novamente.');
    const r=await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-send-test`,{
      method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`,'apikey':SUPABASE_ANON_KEY},
      body:JSON.stringify({to,message})
    });
    const d=await r.json().catch(()=>({}));
    if(!r.ok||d.success!==true)throw new Error(d.error||`Erro HTTP ${r.status}`);
    msg.textContent=`✅ Mensagem enviada para ${d.to_mask||'o número configurado'}.`;
    toast('Mensagem de teste enviada pela API!','ok');
  }catch(e){msg.textContent='❌ '+e.message;toast('Falha no teste do WhatsApp.','error');}
  finally{btn.disabled=false;btn.textContent=old;}
};

if($('saveShopeeConnect'))$('saveShopeeConnect').onclick=async()=>{
  if(!requireAccess())return;
  const appId=$('shopeeAppId').value.trim();
  const secret=$('shopeeSecret').value.trim();
  const msg=$('shopeeConnectMsg');
  const btn=$('saveShopeeConnect');

  if(!appId||!secret){
    msg.textContent='Informe o App ID e o Secret da sua conta Shopee.';
    return;
  }

  const old=btn.textContent;
  btn.disabled=true;
  btn.textContent='Validando...';
  msg.textContent='Validando credenciais com a Shopee...';

  try{
    const{data:{session},error:sessionError}=await sb.auth.getSession();
    if(sessionError)throw sessionError;
    if(!session?.access_token)throw new Error('Sessão expirada. Faça login novamente.');

    const r=await fetch(`${SUPABASE_URL}/functions/v1/shopee-connect`,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':`Bearer ${session.access_token}`,
        'apikey':SUPABASE_ANON_KEY
      },
      body:JSON.stringify({app_id:appId,secret})
    });

    const data=await r.json().catch(()=>({}));
    console.log('shopee-connect:',r.status,data);

    if(!r.ok||data.success!==true||data.connected!==true){
      throw new Error(data.error||`Erro HTTP ${r.status}`);
    }

    $('shopeeSecret').value='';
    closeModal('shopeeConnectModal');
    await loadIntegrations();
    toast('Shopee conectada com sucesso!','ok');
  }catch(e){
    console.error('Shopee connect:',e);
    msg.textContent='Não foi possível conectar: '+(e?.message||String(e));
  }finally{
    btn.disabled=false;
    btn.textContent=old;
  }
};

document.querySelectorAll('.checkout').forEach(btn=>btn.onclick=async()=>{
  const old=btn.textContent;
  btn.disabled=true;
  btn.textContent='Preparando...';
  try{
    const plan=btn.dataset.plan;
    const {data:{session},error:sessionError}=await sb.auth.getSession();
    if(sessionError)throw sessionError;
    if(!session?.access_token)throw new Error('Sessão expirada. Faça login novamente.');

    const r=await fetch(`${SUPABASE_URL}/functions/v1/infinitepay-create`,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':`Bearer ${session.access_token}`,
        'apikey':SUPABASE_ANON_KEY
      },
      body:JSON.stringify({plan,return_url:location.href})
    });

    const data=await r.json().catch(()=>({}));
    console.log('infinitepay-create:',r.status,data);
    if(!r.ok||data.success!==true)throw new Error(data.error||`Erro HTTP ${r.status}`);

    const checkoutUrl=data.checkout_url||data.url||data.payment?.checkout_url||data.payment?.url;
    if(!checkoutUrl)throw new Error('A InfinitePay não retornou o link do checkout.');

    if(data.payment?.order_nsu){
      localStorage.setItem('infinitepay_last_order_nsu',String(data.payment.order_nsu));
    }

    toast('Abrindo checkout seguro da InfinitePay...','ok');
    window.location.href=checkoutUrl;
  }catch(e){
    console.error('InfinitePay checkout:',e);
    toast('Checkout indisponível: '+(e?.message||String(e)),'error');
  }finally{
    btn.disabled=false;
    btn.textContent=old;
  }
});
async function loadAdmin(){
  if(!isAdmin())return;

  const[
    {data:users,error:ue},
    {data:errors},
    {count:postCount},
    {count:activeSubs}
  ]=await Promise.all([
    sb.rpc('admin_list_users'),
    sb.from('error_logs').select('*').order('created_at',{ascending:false}).limit(50),
    sb.from('post_logs').select('*',{count:'exact',head:true}),
    sb.from('subscriptions').select('*',{count:'exact',head:true}).eq('status','active')
  ]);

  if(ue)return toast('Admin SQL incompleto: '+ue.message,'error');

  const arr=users||[];
  $('adminUsers').textContent=arr.length;
  $('adminActiveSubs').textContent=activeSubs||0;
  $('adminPosts').textContent=postCount||0;
  $('adminErrors').textContent=(errors||[]).length;

  $('adminUserList').innerHTML=arr.map(u=>`
    <div class="tableRow">
      <div>
        <b>${esc(u.name||u.email)}</b>
        <small>${esc(u.email)}</small>
      </div>

      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <span class="tag">${esc(u.plan_code||'sem plano')}</span>
        <span>${u.current_period_end
          ? new Date(u.current_period_end).toLocaleDateString('pt-BR')
          : esc(u.subscription_status||'inactive')}</span>
      </div>

      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="secondary" onclick="adminActivatePlan('${u.user_id}','basic')">Básico 30 dias</button>
        <button class="secondary" onclick="adminActivatePlan('${u.user_id}','pro')">Pro 30 dias</button>
        <button class="secondary" onclick="adminActivatePlan('${u.user_id}','premium')">Premium 30 dias</button>
      </div>

      <button class="secondary" onclick="adminToggle('${u.user_id}',${!u.is_blocked})">
        ${u.is_blocked?'Desbloquear':'Bloquear'}
      </button>
    </div>
  `).join('')||'<div class="empty">Nenhum usuário.</div>';

  $('adminErrorList').innerHTML=(errors||[]).map(e=>`
    <div class="tableRow">
      <div><b>${esc(e.source)}</b><small>${fmtDate(e.created_at)}</small></div>
      <span>${esc(e.code||'—')}</span>
      <span>${esc(e.message)}</span>
      <span></span>
    </div>
  `).join('')||'<div class="empty">Nenhum erro.</div>';
}

$('refreshAdmin').onclick=loadAdmin;

window.adminActivatePlan=async(userId,plan)=>{
  if(!isAdmin())return toast('Acesso administrativo negado.','error');

  const names={basic:'Básico',pro:'Pro',premium:'Premium'};
  if(!confirm(`Liberar ${names[plan]||plan} por 30 dias para este usuário?`))return;

  const {data,error}=await sb.rpc('admin_activate_subscription',{
    p_user_id:userId,
    p_plan:plan
  });

  if(error)return toast('Não foi possível liberar o plano: '+error.message,'error');

  await loadAdmin();
  toast(`${names[plan]||plan} liberado por 30 dias.`,'ok');
};

window.adminToggle=async(userId,blocked)=>{
  if(!isAdmin())return;
  const{error}=await sb.rpc('admin_set_user_blocked',{target_user:userId,blocked});
  if(error)return toast(error.message,'error');
  await loadAdmin();
  toast(blocked?'Usuário bloqueado.':'Usuário desbloqueado.','ok');
};

// V5.1 - painel do Bot Automático
const BOT_CONFIG_KEY='botAfiliadosV51Config',BOT_ACTIVE_KEY='botAfiliadosV51Active';
function getBotConfig(){try{return JSON.parse(localStorage.getItem(BOT_CONFIG_KEY))||{interval:15,minDiscount:20,minPrice:10,maxPrice:1000,dailyLimit:30,useML:true,useShopee:false,useWhats:true,useInstagram:false}}catch(e){return{interval:15,minDiscount:20,minPrice:10,maxPrice:1000,dailyLimit:30,useML:true,useShopee:false,useWhats:true,useInstagram:false}}}
function botIsActive(){return localStorage.getItem(BOT_ACTIVE_KEY)==='1'}
function renderBotActivity(){if(!$('botActivity'))return;const rows=(state.posts||[]).slice(0,5);$('botActivity').innerHTML=rows.map(p=>`<div class="activityItem"><b>${esc(p.status==='success'?'Publicado':'Registro')}: ${esc(p.provider||'canal')}</b><span>${p.created_at?new Date(p.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):''}</span></div>`).join('')||'<div class="empty">Nenhuma publicação registrada ainda.</div>'}
function renderBotV51(){
  if(!$('botAutoToggle'))return;
  const c=getBotConfig(),active=botIsActive();
  const setText=(id,text)=>{const el=$(id);if(el)el.textContent=text;};
  $('botAutoToggle').checked=active;
  setText('botToggleText',active?'BOT ATIVO':'BOT DESATIVADO');
  setText('botActiveBadge',active?'ATIVO':'DESATIVADO');
  setText('sideBotBadge',active?'ATIVO':'PAUSADO');
  setText('sideBotToggle',active?'Ⅱ Pausar Bot':'▶ Ativar Bot');
  setText('botIntervalLabel',c.interval>=60?(c.interval/60)+' hora'+(c.interval>60?'s':''):c.interval+' minutos');
  setText('botPostsToday',state.share?.used||0);
  setText('botOnlineStatus',active?'● Configurado':'● Aguardando');
  setText('botHeadline',active?'Automação configurada 🚀':'Pronto para configurar');
  setText('botStatusHelp',active?'Preferências salvas. O worker 24h do backend ainda precisa ser ligado.':'Conecte seus canais e escolha os filtros.');
  setText('nextSearch',active?c.interval+' min':'—');
  setText('channelCount',(c.useWhats?1:0)+(c.useInstagram?1:0));
  renderBotActivity();
}

async function setBotActive(v){
  if(!requireAccess())return;
  const toggle=$('botAutoToggle');
  const sideBtn=$('sideBotToggle');
  if(toggle)toggle.disabled=true;
  if(sideBtn)sideBtn.disabled=true;
  try{
    const {data:{session},error:sessionError}=await sb.auth.getSession();
    if(sessionError)throw sessionError;
    if(!session?.access_token)throw new Error('Sessão expirada. Faça login novamente.');

    const action=v?'activate':'pause';
    const r=await fetch(`${SUPABASE_URL}/functions/v1/bot-automatico`,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':`Bearer ${session.access_token}`,
        'apikey':SUPABASE_ANON_KEY
      },
      body:JSON.stringify({action})
    });

    const data=await r.json().catch(()=>({}));
    console.log('bot-automatico:',r.status,data);

    if(!r.ok || data.success!==true){
      throw new Error(data.error||`Erro HTTP ${r.status}`);
    }

    const active=data.bot?.active===true;
    localStorage.setItem(BOT_ACTIVE_KEY,active?'1':'0');
    renderBotV51();
    toast(active?'Bot Automático ativado no servidor.':'Bot Automático pausado.','ok');
  }catch(e){
    console.error('Erro ao alterar Bot Automático:',e);
    localStorage.setItem(BOT_ACTIVE_KEY,'0');
    if(toggle)toggle.checked=false;
    renderBotV51();
    toast('Não foi possível alterar o Bot: '+(e?.message||String(e)),'error');
  }finally{
    if(toggle)toggle.disabled=false;
    if(sideBtn)sideBtn.disabled=false;
  }
}
if($('botAutoToggle'))$('botAutoToggle').onchange=e=>setBotActive(e.target.checked);
if($('sideBotToggle'))$('sideBotToggle').onclick=()=>setBotActive(!botIsActive());
if($('openBotConfig'))$('openBotConfig').onclick=()=>{const c=getBotConfig();$('botInterval').value=String(c.interval);$('botMinDiscount').value=c.minDiscount;$('botMinPrice').value=c.minPrice;$('botMaxPrice').value=c.maxPrice;$('botDailyLimit').value=c.dailyLimit;$('botUseML').checked=!!c.useML;$('botUseShopee').checked=!!c.useShopee;$('botUseWhats').checked=!!c.useWhats;$('botUseInstagram').checked=!!c.useInstagram;modal('botConfigModal')};
if($('saveBotConfig'))$('saveBotConfig').onclick=()=>{const c={interval:Number($('botInterval').value),minDiscount:Number($('botMinDiscount').value||0),minPrice:Number($('botMinPrice').value||0),maxPrice:Number($('botMaxPrice').value||0),dailyLimit:Number($('botDailyLimit').value||30),useML:$('botUseML').checked,useShopee:$('botUseShopee').checked,useWhats:$('botUseWhats').checked,useInstagram:$('botUseInstagram').checked};localStorage.setItem(BOT_CONFIG_KEY,JSON.stringify(c));closeModal('botConfigModal');renderBotV51();toast('Configurações do Bot salvas.','ok')};
if($('quickCampaign'))$('quickCampaign').onclick=()=>{if(!requireAccess())return;fillCampaignProducts();modal('campaignModal')};
document.querySelectorAll('.channelSoon').forEach(btn=>btn.onclick=()=>toast('Canal preparado no painel. A integração oficial será ligada no backend.','ok'));

function renderDbError(id,label,error){const el=$(id);if(el)el.innerHTML=`<div class="empty">${esc(label)} indisponível: ${esc(error.message)}<br>Execute o SQL atualizado.</div>`}
sb.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'){state.user=null;if(productsRealtimeChannel){sb.removeChannel(productsRealtimeChannel);productsRealtimeChannel=null;}clearTimeout(productsRealtimeTimer);}if(event==='SIGNED_IN'&&session?.user&&!state.user)boot(session.user)});(async()=>{const{data}=await sb.auth.getSession();if(data.session?.user)boot(data.session.user)})();

// Premium Dashboard bridge: visual shortcuts reuse existing bot controls.
document.getElementById('setupOpenConfig')?.addEventListener('click',()=>document.getElementById('openBotConfig')?.click());
document.getElementById('setupActivateBot')?.addEventListener('click',()=>document.getElementById('sideBotToggle')?.click());
