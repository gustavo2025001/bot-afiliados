window.checkML = async () => {
  try {
    const r = await fetch(
      SUPABASE_FUNCTIONS + '/mercadolivre-status',
      {
        method: 'GET',
        cache: 'no-store'
      }
    );

    if (!r.ok) {
      throw new Error('HTTP ' + r.status);
    }

    const d = await r.json();

    if (d.connected === true) {
      localStorage.setItem('mlConnected', '1');

      alert(
        '✅ Mercado Livre conectado com sucesso!'
      );
    } else {
      localStorage.setItem('mlConnected', '0');

      alert(
        '⚠️ Mercado Livre ainda não está conectado.'
      );
    }

    render('api');

  } catch (e) {
    console.error('Erro Mercado Livre:', e);

    alert(
      '❌ Erro ao verificar Mercado Livre: ' +
      e.message
    );
  }
};
