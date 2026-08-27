const SITE_URL = 'https://gustavo2025001.github.io/bot-afiliados/';

const sb = supabase.createClient(
  'https://jhdezfnafhekimolfiuu.supabase.co',
  'sb_publishable_lAfLqmLZ0rp9UZHATVXtyg_4Wmsn18i',
  {
    auth: {
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true
    }
  }
);

const $ = id => document.getElementById(id);

function setStep(numero) {
  const steps = document.querySelectorAll('.step');

  steps.forEach((step, index) => {
    step.classList.toggle('active', index === numero - 1);
  });
}

function showMessage(texto, tipo = '') {
  const msg = $('msg');

  if (!msg) return;

  msg.textContent = texto;

  if (tipo === 'sucesso') {
    msg.style.color = '#63e6a3';
  } else if (tipo === 'erro') {
    msg.style.color = '#ffb347';
  } else {
    msg.style.color = '';
  }
}

function tabs(which) {
  $('signupView').classList.toggle('hidden', which !== 'signup');
  $('loginView').classList.toggle('hidden', which !== 'login');

  $('signupTab').classList.toggle('active', which === 'signup');
  $('loginTab').classList.toggle('active', which === 'login');

  showMessage('');

  if (which === 'signup') {
    setStep(1);
  }
}

$('signupTab').onclick = () => tabs('signup');
$('loginTab').onclick = () => tabs('login');

$('backLogin').onclick = () => {
  $('verifyCard').classList.add('hidden');
  $('authCard').classList.remove('hidden');

  tabs('login');
  setStep(2);

  showMessage(
    '✅ E-mail verificado! Entre com seu e-mail e senha.',
    'sucesso'
  );
};

function passwordOK(p) {
  return (
    p.length >= 8 &&
    /[A-Z]/.test(p) &&
    /[0-9]/.test(p) &&
    /[^A-Za-z0-9]/.test(p)
  );
}

$('signupPassword').oninput = e => {
  const p = e.target.value;

  const checks = [
    p.length >= 8,
    /[A-Z]/.test(p),
    /[0-9]/.test(p),
    /[^A-Za-z0-9]/.test(p)
  ];

  checks.forEach((ok, i) => {
    $('r' + (i + 1)).classList.toggle('ok', ok);
  });

  const quantidade = checks.filter(Boolean).length;

  $('strengthBar').style.width = (quantidade * 25) + '%';

  $('strengthText').textContent =
    quantidade < 2
      ? 'Fraca'
      : quantidade < 4
      ? 'Média'
      : 'Forte';
};

$('signupBtn').onclick = async () => {
  const name = $('name').value.trim();
  const email = $('signupEmail').value.trim();
  const phone = $('phone').value.trim();
  const phone2 = $('phone2').value.trim();
  const password = $('signupPassword').value;
  const password2 = $('password2').value;

  if (!name || !email || !phone || !password) {
    return showMessage(
      'Preencha todos os campos.',
      'erro'
    );
  }

  if (phone !== phone2) {
    return showMessage(
      'Os telefones não conferem.',
      'erro'
    );
  }

  if (password !== password2) {
    return showMessage(
      'As senhas não conferem.',
      'erro'
    );
  }

  if (!passwordOK(password)) {
    return showMessage(
      'Use uma senha com 8+ caracteres, maiúscula, número e caractere especial.',
      'erro'
    );
  }

  if (!$('terms').checked) {
    return showMessage(
      'Aceite os Termos de Uso e a Política de Privacidade.',
      'erro'
    );
  }

  showMessage('Criando conta...');

  const { data, error } = await sb.auth.signUp({
    email,
    password,

    options: {
      data: {
        name,
        phone
      },

      emailRedirectTo: SITE_URL
    }
  });

  if (error) {
    return showMessage(error.message, 'erro');
  }

  if (data.session) {
    showPanel(data.user);
    return;
  }

  $('verifyEmail').textContent = email;

  $('authCard').classList.add('hidden');
  $('verifyCard').classList.remove('hidden');

  setStep(2);
};

$('loginBtn').onclick = async () => {
  const email = $('loginEmail').value.trim();
  const password = $('loginPassword').value;

  if (!email || !password) {
    return showMessage(
      'Digite seu e-mail e sua senha.',
      'erro'
    );
  }

  showMessage('Entrando...');

  const { data, error } = await sb.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    if (error.message === 'Invalid login credentials') {
      return showMessage(
        'E-mail ou senha incorretos.',
        'erro'
      );
    }

    return showMessage(error.message, 'erro');
  }

  showPanel(data.user);
};

$('forgotBtn').onclick = async () => {
  const email = $('loginEmail').value.trim();

  if (!email) {
    return showMessage(
      'Digite seu e-mail primeiro.',
      'erro'
    );
  }

  showMessage('Enviando recuperação...');

  const { error } = await sb.auth.resetPasswordForEmail(
    email,
    {
      redirectTo: SITE_URL
    }
  );

  if (error) {
    return showMessage(error.message, 'erro');
  }

  showMessage(
    '✅ Link de recuperação enviado para seu e-mail.',
    'sucesso'
  );
};

function showPanel(user) {
  $('authCard').classList.add('hidden');
  $('verifyCard').classList.add('hidden');
  $('panel').classList.remove('hidden');

  setStep(3);

  $('welcome').textContent =
    (user.user_metadata?.name || user.email) +
    ' • ' +
    user.email;
}

function showVerifiedLogin() {
  $('panel').classList.add('hidden');
  $('verifyCard').classList.add('hidden');
  $('authCard').classList.remove('hidden');

  tabs('login');
  setStep(2);

  showMessage(
    '✅ E-mail verificado com sucesso! Sua conta está ativa. Agora entre para continuar.',
    'sucesso'
  );
}

$('logoutBtn').onclick = async () => {
  await sb.auth.signOut();

  window.location.href = SITE_URL;
};

function veioDaConfirmacao() {
  const hash = window.location.hash;
  const search = window.location.search;

  return (
    hash.includes('type=signup') ||
    hash.includes('access_token=') ||
    search.includes('type=signup') ||
    search.includes('code=')
  );
}

const retornoConfirmacao = veioDaConfirmacao();

sb.auth.onAuthStateChange((event, session) => {
  if (session?.user) {
    showPanel(session.user);
  }
});

(async () => {
  const { data } = await sb.auth.getSession();

  if (data.session?.user) {
    showPanel(data.session.user);
    return;
  }

  if (retornoConfirmacao) {
    showVerifiedLogin();

    setTimeout(() => {
      history.replaceState(
        {},
        document.title,
        window.location.pathname
      );
    }, 500);
  }
})();
