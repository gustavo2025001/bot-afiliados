const SUPABASE_URL="https://jhdezfnafhekimolfiuu.supabase.co";
const SUPABASE_ANON_KEY="sb_publishable_lAfLqmLZ0rp9UZHATVXtyg_4Wmsn18i";

// Vitrine pública do Gustavo quando o endereço é aberto sem parâmetro.
// Para clientes, ?loja=UUID continua sobrescrevendo este valor.
const DEFAULT_STORE_OWNER="b1fa7a00-02fe-4c7c-b2a5-3873eee3f5d1";

const params=new URLSearchParams(location.search);
const owner=params.get("loja")||params.get("user")||DEFAULT_STORE_OWNER;
let products=[],filter="all";

const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const money=n=>Number(n||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const safeUrl=u=>{
  try{
    const x=new URL(String(u||""));
    return x.protocol==="https:"||x.protocol==="http:"?x.href:"#";
  }catch{return "#";}
};
const platformName=p=>{
  const v=String(p||"").toLowerCase();
  if(v==="mercadolivre")return "Mercado Livre";
  if(v==="shopee")return "Shopee";
  return p||"Oferta";
};
const buyLabel=p=>{
  const v=String(p||"").toLowerCase();
  if(v==="mercadolivre")return "🛒 COMPRAR NO MERCADO LIVRE";
  if(v==="shopee")return "🛒 COMPRAR NA SHOPEE";
  return "🛒 VER OFERTA";
};

function productImage(p){
  const url=safeUrl(p.image_url);
  if(url==="#") return `<div class="no-image">🛍️</div>`;
  return `<img src="${esc(url)}" alt="${esc(p.title)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=&quot;no-image&quot;>🛍️</div>'">`;
}

function render(){
  const q=$("searchInput").value.trim().toLowerCase();
  let list=products.filter(p=>!q||[p.title,p.platform].join(" ").toLowerCase().includes(q));

  if(filter==="shopee") list=list.filter(p=>String(p.platform||"").toLowerCase()==="shopee");
  if(filter==="mercadolivre") list=list.filter(p=>String(p.platform||"").toLowerCase()==="mercadolivre");
  if(filter==="recent") list=[...list].sort((a,b)=>new Date(b.updated_at||b.created_at)-new Date(a.updated_at||a.created_at));

  $("status").textContent=list.length
    ? `${list.length} oferta${list.length===1?"":"s"} disponível${list.length===1?"":"is"}`
    : "Nenhuma oferta encontrada com esse filtro.";

  $("grid").innerHTML=list.map(p=>`
    <article class="product">
      <div class="photo">${productImage(p)}</div>
      <div class="info">
        <span class="tag">🛍️ ${esc(platformName(p.platform))}</span>
        <div class="title">${esc(p.title)}</div>
        <div class="price">${money(p.price)}</div>
        <a class="buy" href="${esc(safeUrl(p.affiliate_url))}" target="_blank" rel="noopener sponsored" data-buy-product="${esc(p.id)}">${esc(buyLabel(p.platform))}</a>
      </div>
    </article>`).join("");
}

async function trackStoreClick(productId){
  try{
    const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/track_store_click`,{
      method:"POST",
      cache:"no-store",
      keepalive:true,
      headers:{
        apikey:SUPABASE_ANON_KEY,
        Authorization:`Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        p_user_id:owner,
        p_product_id:productId
      })
    });

    if(!r.ok){
      const errorText=await r.text();
      console.error("Erro ao registrar clique da vitrine:",r.status,errorText);
      return;
    }

    console.log("Clique da vitrine registrado:",productId);
  }catch(e){
    console.error("Erro ao registrar clique da vitrine:",e);
  }
}

document.addEventListener("click",e=>{
  const link=e.target.closest("[data-buy-product]");
  if(!link) return;

  const productId=link.getAttribute("data-buy-product");
  if(productId) trackStoreClick(productId);
});

async function load(){
  $("status").textContent="Carregando ofertas...";
  try{
    const url=`${SUPABASE_URL}/rest/v1/rpc/get_public_store_products`;
    const r=await fetch(url,{
      method:"POST",
      cache:"no-store",
      headers:{
        apikey:SUPABASE_ANON_KEY,
        Authorization:`Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type":"application/json"
      },
      body:JSON.stringify({p_user_id:owner})
    });

    if(!r.ok){
      const errorText=await r.text();
      throw new Error(`HTTP ${r.status}: ${errorText}`);
    }

    products=await r.json();
    render();
  }catch(e){
    console.error("Erro ao carregar vitrine:",e);
    $("status").innerHTML=`Não foi possível carregar as ofertas agora. <button id="retryBtn" class="retry">Tentar novamente</button>`;
    document.getElementById("retryBtn")?.addEventListener("click",load);
  }
}

$("searchInput").addEventListener("input",render);
$("searchBtn").addEventListener("click",render);
$("searchInput").addEventListener("keydown",e=>{if(e.key==="Enter")render();});

document.querySelectorAll("[data-filter]").forEach(b=>b.onclick=()=>{
  document.querySelectorAll("[data-filter]").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");
  filter=b.dataset.filter;
  render();
});

load();
