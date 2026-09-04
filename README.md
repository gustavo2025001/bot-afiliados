# Bot Afiliados Premium — versão refeita

Esta versão mantém o cadastro/login do Supabase e refaz o painel no visual Premium escuro/roxo. A URL do GitHub Pages pode continuar a mesma: substitua os arquivos da raiz do repositório.

## O que funciona depois de executar o SQL

- Cadastro, confirmação de e-mail, login, recuperação de senha e sessão.
- Usuários e produtos separados por `auth.uid()` com RLS.
- Bloqueio das funções para usuário sem assinatura ativa.
- Planos: Básico R$ 60 / 30 dias (70 compartilhamentos por dia), Pro R$ 80 / 30 dias (100/dia) e Premium R$ 120 / 30 dias (ilimitado).
- Contador diário real no Supabase. O limite reinicia no dia seguinte usando o fuso `America/Sao_Paulo`.
- Importação manual de oferta colando texto/link; título, preço e link podem ser preenchidos automaticamente.
- Produtos/ofertas salvos no Supabase.
- Favoritos e fila salvos no Supabase.
- Gerador de mensagem de oferta.
- Compartilhamento assistido no WhatsApp com consumo do limite diário registrado no banco.
- Campanhas no Supabase.
- Agendamentos no Supabase.
- Histórico de compartilhamentos.
- Área Admin protegida no banco. O SQL força como admin somente `gustavodepaulabarbosag@gmail.com` e remove `admin` de outros perfis.
- Admin pode listar usuários/assinaturas e bloquear/liberar usuários.

## Passo 1 — Supabase

Abra **SQL Editor** e execute `supabase_v4.sql` inteiro. Ele é idempotente para as estruturas principais e inclui a atualização de ofertas/fila/limite diário.

Não desative RLS. Não coloque `service_role` no navegador.

## Passo 2 — GitHub Pages

Envie para a raiz do repositório:

- `index.html`
- `style.css`
- `app.js`
- `README.md`

A pasta `supabase/` não é executada pelo GitHub Pages; ela contém Edge Functions que devem ser publicadas no Supabase quando as integrações forem ativadas.

## O que ainda depende de credenciais externas

### Busca automática de ofertas

O botão **Buscar ofertas** chama `supabase/functions/fetch-offers`. A função está preparada e retorna uma mensagem clara enquanto não houver API oficial configurada. Para importar ofertas automaticamente ainda são necessárias as credenciais/permissões oficiais da Shopee e/ou Mercado Livre liberadas para a conta.

### PIX e cartão

Os botões chamam `create-checkout`. Ainda é necessário escolher/configurar um gateway com PIX + cartão, guardar as chaves em **Supabase Secrets** e completar `create-checkout` + `payment-webhook`. O plano só deve ser ativado após webhook validado do gateway.

### Postagem 100% automática

A V5.2 adiciona a conexão real com a WhatsApp Cloud API pelo Supabase. O token de cada usuário é enviado somente à Edge Function e armazenado criptografado; o navegador continua sem acesso direto ao segredo. O compartilhamento assistido antigo foi mantido como fallback. Para ativar a V5.2, siga `ATUALIZACAO_WHATSAPP_V5.2.txt`.

Para automação avançada, inclusive execução agendada com o navegador fechado, ainda é necessário:

1. WhatsApp Business Platform/Cloud API autorizada e consentimento dos destinatários;
2. templates aprovados quando exigidos pela política/janela de mensagens;
3. worker/Edge Function para os agendamentos;
4. Supabase Cron/scheduler para executar a função.

A V5.2 já conecta a Cloud API, testa o envio e permite que a fila envie automaticamente ao destinatário padrão configurado.

Shopee e Mercado Livre também só podem usar os endpoints e permissões oficialmente disponibilizados para a conta. O projeto não usa scraping nem coloca senha/token secreto no GitHub.

## Segurança

A publishable/anon key pode estar no frontend com RLS correto. Nunca publique `service_role`, client secret OAuth, segredo de webhook ou chave privada de pagamento. Assinaturas, limites e privilégios de Admin são validados no banco/backend, não apenas escondidos na interface.
