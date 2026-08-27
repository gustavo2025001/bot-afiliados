const sb=supabase.createClient('https://jhdezfnafhekimolfiuu.supabase.co','sb_publishable_lAfLqmLZ0rp9UZHATVXtyg_4Wmsn18i');

const $=id=>document.getElementById(id);

const SITE_URL='https://gustavo2025001.github.io/bot-afiliados/';

function tabs(which){
  $('signupView').classList.toggle('hidden',which!=='signup');
  $('loginView').classList.toggle('hidden',which!=='login');
  $('signupTab').classList.toggle('active',which==='signup');
  $('loginTab').classList.toggle('active',which==='login');
  $('msg').textContent='';
}

$('signupTab').onclick=()=>tabs('signup');

$('loginTab').onclick=()=>tabs('login');

$('backLogin').onclick=()=>{
  $('verifyCard').classList.add('hidden');
  $('authCard').classList.remove('hidden');
  tabs('login');
};

function passwordOK(p){
  return p.length>=8 &&
         /[A-Z]/.test(p) &&
         /[0-9]/.test(p) &&
         /[^A-Za-z0-9]/.test(p);
}

$('signupPassword').oninput=e=>{
  const p=e.target.value;

  let checks=[
    p.length>=8,
    /[A-Z]/.test(p),
    /[0-9]/.test(p),
    /[^A-Za-z0-9]/.test(p)
  ];

  checks.forEach((x,i)=>{
    $('r'+(i+1)).classList.toggle('ok',x);
  });

  let n=checks.filter(Boolean).length;

  $('strengthBar').style.width=(n*25)+'%';
  $('strengthText').textContent=
    n<2?'Fraca':
    n<4?'Média':'Forte';
};

$('signupBtn').onclick=async()=>{

  const name=$('name').value.trim();
  const email=$('signupEmail').value.trim();
  const phone=$('phone').value.trim();
  const phone2=$('phone2').value.trim();
  const p=$('signupPassword').value;
  const p2=$('password2').value;

  if(!name||!email||!phone||!p)
    return $('msg').textContent='Preencha todos os campos.';

  if(phone!==phone2)
    return $('msg').textContent='Os telefones não conferem.';

  if(p!==p2)
    return $('msg').textContent='As senhas não conferem.';

  if(!passwordOK(p))
    return $('msg').textContent=
      'Use uma senha com 8+ caracteres, maiúscula, número e caractere especial.';

  if(!$('terms').checked)
    return $('msg').textContent=
      'Aceite os Termos de Uso e a Política de Privacidade.';

  $('msg').textContent='Criando conta...';

  const {data,error}=await sb.auth.signUp({
    email:email,
    password:p,

    options:{
      data:{
        name:name,
        phone:phone
      },

      emailRedirectTo:SITE_URL
    }
  });

  if(error){
    $('msg').textContent=error.message;
    return;
  }

  if(data.session){
    showPanel(data.user);
    return;
  }

  $('verifyEmail').textContent=email;

  $('authCard').classList.add('hidden');
  $('verifyCard').classList.remove('hidden');
};


$('loginBtn').onclick=async()=>{

  const email=$('loginEmail').value.trim();
  const password=$('loginPassword').value;

  if(!email||!password){
    $('msg').textContent='Digite seu e-mail e sua senha.';
    return;
  }

  $('msg').textContent='Entrando...';

  const {data,error}=await sb.auth.signInWithPassword({
    email:email,
    password:password
  });

  if(error){
    $('msg').textContent=error.message;
    return;
  }

  showPanel(data.user);
};


$('forgotBtn').onclick=async()=>{

  const email=$('loginEmail').value.trim();

  if(!email){
    $('msg').textContent='Digite seu e-mail primeiro.';
    return;
  }

  $('msg').textContent='Enviando recuperação...';

  const {error}=await sb.auth.resetPasswordForEmail(
    email,
    {
      redirectTo:SITE_URL
    }
  );

  if(error){
    $('msg').textContent=error.message;
    return;
  }

  $('msg').textContent=
    'Enviamos o link de recuperação para seu e-mail.';
};


function showPanel(u){

  $('authCard').classList.add('hidden');
  $('verifyCard').classList.add('hidden');
  $('panel').classList.remove('hidden');

  $('welcome').textContent=
    (u.user_metadata?.name||u.email)+' • '+u.email;
}


$('logoutBtn').onclick=async()=>{

  await sb.auth.signOut();

  window.location.href=SITE_URL;
};


sb.auth.onAuthStateChange((event,session)=>{

  if(session?.user){
    showPanel(session.user);
  }

});


(async()=>{

  const {data}=await sb.auth.getSession();

  if(data.session?.user){
    showPanel(data.session.user);
  }

})();
