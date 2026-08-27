# Bot Afiliados V4 Premium

Esta V4 mantém o cadastro/login Supabase da V3 e muda o armazenamento operacional para o banco Supabase com RLS. O visual escuro/roxo foi preservado e a aplicação continua sendo estática, portanto pode permanecer na mesma URL do GitHub Pages substituindo os arquivos atuais.

## O que já fica operacional após executar `supabase_v4.sql`

- Cadastro, confirmação de e-mail, login, recuperação de senha e sessão pelo Supabase Auth.
- Perfil automático por usuário.
- Bloqueio das áreas operacionais quando não há assinatura ativa (também reforçado por RLS, não apenas pela interface).
- Produtos salvos no Supabase e separados por usuário.
- Campanhas salvas no Supabase e separadas por usuário.
- Agendamentos salvos no Supabase e separados por usuário.
- Página de Planos (Básico, Pro e Premium).
- Área Admin visível apenas para `role = admin`, com listagem segura de usuários/assinaturas, bloqueio/liberação, contadores de postagens e erros.
- Estrutura de logs de postagens/erros e integrações.

## Passo 1 — banco de dados

Abra Supabase > SQL Editor e execute `supabase_v4.sql` inteiro. Depois troque `SEU_EMAIL_AQUI` pelo seu e-mail e execute apenas a linha final indicada para transformar sua própria conta em admin.

Atenção: as políticas RLS verificam o `auth.uid()` e a assinatura. Não desative RLS para “fazer funcionar”.

## Passo 2 — GitHub Pages

Na raiz do seu repositório, substitua `index.html`, `style.css`, `app.js` e `README.md` pelos arquivos desta V4. A URL do GitHub Pages permanece a mesma porque o repositório/caminho não muda.

A publishable/anon key do Supabase pode ficar no frontend quando RLS está correto. NUNCA coloque `service_role`, segredo de webhook, secret de OAuth ou chave privada de gateway no GitHub.

## Pagamento PIX/cartão — estrutura pronta, ainda precisa de gateway

O botão de checkout chama `supabase/functions/create-checkout`. A ativação automática deve ocorrer somente no webhook `supabase/functions/payment-webhook` após o gateway confirmar o pagamento.

Ainda falta escolher o gateway que será usado (por exemplo, um provedor que ofereça PIX + cartão e webhooks), criar a conta comercial nesse gateway e obter as credenciais. Depois é necessário colocar as credenciais em **Supabase Secrets**, nunca em `app.js`, implementar o adaptador do gateway nas duas Edge Functions e configurar a URL pública do webhook no painel do gateway.

Dados que normalmente serão necessários: chave/token secreto do gateway, segredo/assinatura do webhook, identificadores de produto/preço se o gateway usar catálogo, URL de retorno do checkout e URL da Edge Function de webhook.

## Shopee, Mercado Livre e WhatsApp — estrutura pronta, credenciais ainda necessárias

`oauth-start` é o ponto de entrada para OAuth/conexão. `integrations` guarda apenas estado/metadados públicos. Tokens privados devem ficar protegidos no backend/Vault/Secrets e nunca no GitHub Pages.

Para deixar cada integração realmente enviando/publicando, faltam credenciais e permissões oficiais da respectiva plataforma:

- **Shopee:** acesso/API oficial aplicável à sua conta de afiliado/parceiro, Client/App ID, secret e callback autorizado. A disponibilidade de endpoints de publicação depende do programa/conta liberado pela Shopee.
- **Mercado Livre:** aplicação registrada, Client ID/Secret, redirect URI e permissões OAuth adequadas. O tipo exato de postagem permitido depende da API e da conta.
- **WhatsApp:** WhatsApp Business Platform/Cloud API autorizada, Business Account, Phone Number ID, access token/backend seguro e templates aprovados quando exigidos. Para disparos, é obrigatório seguir consentimento e regras anti-spam da plataforma.

## Postagem automática / Agendamentos

A tabela `schedules` e a função `run-scheduled-posts` formam a base do executor. Para operação real ainda é preciso:

1. Configurar as integrações oficiais e credenciais.
2. Implementar o adaptador de envio de cada provedor dentro da Edge Function.
3. Guardar tokens de modo seguro (Secrets/Vault/backend).
4. Agendar `run-scheduled-posts` via Supabase Cron/pg_cron ou scheduler autorizado.
5. Registrar sucesso/falha em `post_logs` e detalhes técnicos em `error_logs`.

## Assinaturas para teste

Enquanto o gateway não está conectado, o administrador pode criar manualmente uma assinatura ativa no SQL Editor para testar as áreas protegidas (troque o e-mail e plano):

```sql
insert into public.subscriptions(user_id,plan_code,status,current_period_start,current_period_end,payment_provider)
select id,'premium','active',now(),now()+interval '30 days','manual-test'
from public.profiles where email='EMAIL_DO_USUARIO';
```

Isso é somente para teste/admin. A versão de produção deve ativar assinatura a partir do webhook validado do gateway.

## Edge Functions

A pasta `supabase/functions/` contém os pontos seguros de backend preparados. Eles não são publicados pelo GitHub Pages. Devem ser implantados no projeto Supabase pela CLI/Dashboard quando você for configurar gateway e APIs.

## Segurança

- RLS habilitado nas tabelas sensíveis.
- Produtos/campanhas/agendamentos são vinculados ao usuário autenticado.
- Assinaturas não podem ser criadas pelo navegador.
- Admin é definido no banco e não por botão público.
- Nunca use `service_role` no frontend.
- Nunca confie em preço/status vindo do navegador para aprovar pagamento.
- Todo webhook de pagamento precisa validar assinatura e deduplicar eventos.
