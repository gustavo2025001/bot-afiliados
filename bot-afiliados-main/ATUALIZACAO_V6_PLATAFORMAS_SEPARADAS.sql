-- BOT AFILIADOS PREMIUM V6.0
-- SHOPEE + MERCADO LIVRE SEPARADOS POR CLIENTE
-- Execute uma vez no SQL Editor do Supabase antes de publicar as novas Edge Functions.

-- 1) MERCADO LIVRE: reaproveita a tabela existente sem apagar tokens antigos.
alter table if exists public.mercadolivre_tokens
  add column if not exists supabase_user_id uuid references auth.users(id) on delete cascade;
alter table if exists public.mercadolivre_tokens
  add column if not exists ml_user_id text;
alter table if exists public.mercadolivre_tokens
  add column if not exists status text not null default 'connected';

-- A tabela antiga exigia id manual. Criamos um default para novas conexoes.
create sequence if not exists public.mercadolivre_tokens_id_seq;
select setval('public.mercadolivre_tokens_id_seq', greatest(coalesce((select max(id) from public.mercadolivre_tokens),0),1));
alter table if exists public.mercadolivre_tokens
  alter column id set default nextval('public.mercadolivre_tokens_id_seq');

create unique index if not exists mercadolivre_tokens_supabase_user_uidx
  on public.mercadolivre_tokens(supabase_user_id);

-- State OAuth separado por usuario do Bot.
create table if not exists public.mercadolivre_oauth_states (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.mercadolivre_oauth_states enable row level security;
create index if not exists mercadolivre_oauth_states_exp_idx
  on public.mercadolivre_oauth_states(expires_at);

-- 2) BOT: cada origem pode ser ligada/pausada independentemente.
alter table if exists public.bot_automation_settings
  add column if not exists mercadolivre_active boolean not null default true;
alter table if exists public.bot_automation_settings
  add column if not exists shopee_active boolean not null default true;
alter table if exists public.bot_automation_settings
  add column if not exists mercadolivre_interval_minutes integer not null default 15;
alter table if exists public.bot_automation_settings
  add column if not exists shopee_interval_minutes integer not null default 15;

-- Mantem as colunas antigas use_mercadolivre/use_shopee como selecao da origem.
-- Nao apaga produtos, fila, historico nem credenciais de outras integracoes.
