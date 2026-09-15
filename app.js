const SUPABASE_URL="https://jhdezfnafhekimolfiuu.supabase.co";
const SUPABASE_ANON_KEY="sb_publishable_lAfLqmLZ0rp9UZHATVXtyg_4Wmsn18i";
const params=new URLSearchParams(location.search);
const owner=params.get("loja")||params.get("user")||"";
let products=[],filter="all";

const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const money=n=>Number(n||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

function render(){
  const q=document.getElementById("searchInput").value.trim().toLowerCase();
  let list=products.filter(p=>!q||String(p.title||"").toLowerCase().includes(q));
  if(filter==="shopee")list=list.filter(p=>String(p.platform||"").toLowerCase()==="shopee");
  if(filter==="recent")list=[...list].sort((a,b)=>new Date(b.updated_at||b.created_at)-new Date(a.updated_at||a.created_at));
  document.getElementById("status").textContent=list.length?`${list.length} ofertas disponíveis`:"Nenhuma oferta encontrada.";
  document.getElementById("grid").innerHTML=list.map(p=>`
    <article class="product">
      <div class="photo"><img src="${esc(p.image_url)}" alt="${esc(p.title)}" loading="lazy"></div>
      <div class="info">
        <span class="tag">🛍️ ${esc(p.platform||"Shopee")}</span>
        <div class="title">${esc(p.title)}</div>
        <div class="price">${money(p.price)}</div>
        <a class="buy" href="${esc(p.affiliate_url)}" target="_blank" rel="noopener sponsored">🛒 COMPRAR NA SHOPEE</a>
      </div>
    </article>`).join("");
}

async function load(){
  if(!owner){
    document.getElementById("status").innerHTML="Vitrine sem identificador de cliente. Abra o link fornecido pelo afiliado.";
    return;
  }
  try{
    const url=`${SUPABASE_URL}/rest/v1/rpc/get_public_store_products`;
    const r=await fetch(url,{
      method:"POST",
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
    console.error(e);
    document.getElementById("status").textContent="Não foi possível carregar as ofertas desta vitrine.";
  }
}

document.getElementById("searchInput").addEventListener("input",render);
document.getElementById("searchBtn").addEventListener("click",render);
document.querySelectorAll("[data-filter]").forEach(b=>b.onclick=()=>{
  document.querySelectorAll("[data-filter]").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");filter=b.dataset.filter;render();
});
load();