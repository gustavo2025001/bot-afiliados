const sb=supabase.createClient('https://jhdezfnafhekimolfiuu.supabase.co','sb_publishable_lAfLqmLZ0rp9UZHATVXtyg_4Wmsn18i');
const $=id=>document.getElementById(id);
function tabs(which){$('signupView').classList.toggle('hidden',which!=='signup');$('loginView').classList.toggle('hidden',which!=='login');$('signupTab').classList.toggle('active',which==='signup');$('loginTab').classList.toggle('active',which==='login');$('msg').textContent='';}
$('signupTab').onclick=()=>tabs('signup'); $('loginTab').onclick=()=>tabs('login'); $('backLogin').onclick=()=>{$('verifyCard').classList.add('hidden');$('authCard').classList.remove('hidden');tabs('login')};
function passwordOK(p){return p.length>=8&&/[A-Z]/.test(p)&&/[0-9]/.test(p)&&/[^A-Za-z0-9]/.test(p)}
$('signupPassword').oninput=e=>{const p=e.target.value;let checks=[p.length>=8,/[A-Z]/.test(p),/[0-9]/.test(p),/[^A-Za-z0-9]/.test(p)];checks.forEach((x,i)=>$('r'+(i+1)).classList.toggle('ok',x));let n=checks.filter(Boolean).length;$('strengthBar').style.width=(n*25)+'%';$('strengthText').textContent=n<2?'Fraca':n<4?'Média':'Forte';};
$('signupBtn').onclick=async()=>{const name=$('name').value.trim(),email=$('signupEmail').value.trim(),phone=$('phone').value.trim(),phone2=$('phone2').value.trim(),p=$('signupPassword').value,p2=$('password2').value;
if(!name||!email||!phone||!p) return $('msg').textContent='Preencha todos os campos.';
if(phone!==phone2) return $('msg').textContent='Os telefones não conferem.';
if(p!==p2) return $('msg').textContent='As senhas não conferem.';
if(!passwordOK(p)) return $('msg').textContent='Use uma senha com 8+ caracteres, maiúscula, número e caractere especial.';
if(!$('terms').checked) return $('msg').textContent='Aceite os Termos de Uso e a Política de Privacidade.';
$('msg').textContent='Criando conta...';
const {data,error}=await sb.auth.signUp({email,password:p,options:{data:{name,phone}}});
if(error) return $('msg').textContent=error.message;
if(data.session) return showPanel(data.user);
$('verifyEmail').textContent=email;$('authCard').classList.add('hidden');$('verifyCard').classList.remove('hidden');
};
$('loginBtn').onclick=async()=>{$('msg').textContent='Entrando...';const {data,error}=await sb.auth.signInWithPassword({email:$('loginEmail').value.trim(),password:$('loginPassword').value});if(error)return $('msg').textContent=error.message;showPanel(data.user)};
$('forgotBtn').onclick=async()=>{const email=$('loginEmail').value.trim();if(!email)return $('msg').textContent='Digite seu e-mail primeiro.';const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});$('msg').textContent=error?error.message:'Enviamos o link de recuperação para seu e-mail.';};
function showPanel(u){$('authCard').classList.add('hidden');$('verifyCard').classList.add('hidden');$('panel').classList.remove('hidden');$('welcome').textContent=(u.user_metadata?.name||u.email)+' • '+u.email;}
$('logoutBtn').onclick=async()=>{await sb.auth.signOut();location.reload()};
(async()=>{const{data}=await sb.auth.getSession();if(data.session?.user)showPanel(data.session.user);})();