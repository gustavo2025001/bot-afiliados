create table if not exists public.mercadolivre_tokens (
  id integer primary key,
  user_id text,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.mercadolivre_tokens enable row level security;
-- Sem policies públicas: somente a Edge Function com service role acessa os tokens.
