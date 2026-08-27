-- BOT AFILIADOS V4 - BANCO + RLS + ADMIN
-- Execute uma vez no SQL Editor do seu projeto Supabase.
-- Depois marque manualmente o seu usuário como admin conforme instrução no final.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  phone text,
  role text not null default 'user' check (role in ('user','admin')),
  is_blocked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plans (
  code text primary key,
  name text not null,
  price_cents integer not null check(price_cents >= 0),
  active boolean not null default true,
  limits jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.plans(code,name,price_cents,limits) values
 ('basic','Básico',6000,'{"daily_shares":70,"duration_days":30}'::jsonb),
 ('pro','Pro',8000,'{"daily_shares":100,"duration_days":30}'::jsonb),
 ('premium','Premium',12000,'{"daily_shares":null,"duration_days":30,"unlimited":true}'::jsonb)
on conflict(code) do update set name=excluded.name,price_cents=excluded.price_cents,limits=excluded.limits;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_code text not null references public.plans(code),
  status text not null default 'pending' check(status in ('pending','active','past_due','canceled','expired','refunded')),
  payment_provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_user_idx on public.subscriptions(user_id,created_at desc);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  price numeric(12,2) not null default 0,
  platform text not null,
  affiliate_url text not null,
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_user_idx on public.products(user_id,created_at desc);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  message text not null,
  channels text[] not null default '{}',
  status text not null default 'draft' check(status in ('draft','ready','paused','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists campaigns_user_idx on public.campaigns(user_id,created_at desc);

create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  scheduled_for timestamptz not null,
  timezone text not null default 'America/Sao_Paulo',
  status text not null default 'pending' check(status in ('pending','processing','completed','partial','failed','canceled')),
  attempts integer not null default 0,
  locked_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists schedules_due_idx on public.schedules(status,scheduled_for);
create index if not exists schedules_user_idx on public.schedules(user_id,scheduled_for);

create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check(provider in ('shopee','mercadolivre','whatsapp')),
  status text not null default 'disconnected' check(status in ('disconnected','pending','connected','error')),
  external_account_id text,
  -- NUNCA armazene access token puro aqui via navegador. Use Vault/Secrets/backend quando possível.
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,provider)
);

create table if not exists public.post_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  schedule_id uuid references public.schedules(id) on delete set null,
  provider text not null,
  status text not null check(status in ('queued','sent','failed','skipped')),
  external_id text,
  error_message text,
  response_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists post_logs_user_idx on public.post_logs(user_id,created_at desc);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_event_id text not null,
  event_type text,
  user_id uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  processed boolean not null default false,
  created_at timestamptz not null default now(),
  unique(provider,external_event_id)
);

create table if not exists public.error_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  source text not null,
  code text,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Cria/atualiza perfil automaticamente usando os metadados do cadastro V3/V4.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles(id,email,name,phone)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'name',''),coalesce(new.raw_user_meta_data->>'phone',''))
  on conflict(id) do update set email=excluded.email,name=excluded.name,phone=excluded.phone,updated_at=now();
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert or update of email,raw_user_meta_data on auth.users
for each row execute procedure public.handle_new_user();

-- Backfill de perfis já existentes.
insert into public.profiles(id,email,name,phone)
select id,email,coalesce(raw_user_meta_data->>'name',''),coalesce(raw_user_meta_data->>'phone','') from auth.users
on conflict(id) do update set email=excluded.email,name=excluded.name,phone=excluded.phone;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and p.is_blocked=false); $$;

create or replace function public.has_active_subscription(target_user uuid default auth.uid())
returns boolean
language sql stable security definer set search_path=public
as $$
  select public.is_admin() or exists(
    select 1 from public.subscriptions s join public.profiles p on p.id=s.user_id
    where s.user_id=target_user and p.is_blocked=false and s.status='active'
      and (s.current_period_end is null or s.current_period_end > now())
  );
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.products enable row level security;
alter table public.campaigns enable row level security;
alter table public.schedules enable row level security;
alter table public.integrations enable row level security;
alter table public.post_logs enable row level security;
alter table public.payment_events enable row level security;
alter table public.error_logs enable row level security;

-- Removemos políticas com os mesmos nomes para o script poder ser reexecutado.
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "profiles_update_own_or_admin" on public.profiles;
drop policy if exists "plans_public_read" on public.plans;
drop policy if exists "subscriptions_select_own_or_admin" on public.subscriptions;
drop policy if exists "products_owner_all" on public.products;
drop policy if exists "campaigns_owner_all" on public.campaigns;
drop policy if exists "schedules_owner_all" on public.schedules;
drop policy if exists "integrations_owner_read" on public.integrations;
drop policy if exists "post_logs_owner_read" on public.post_logs;
drop policy if exists "error_logs_admin_read" on public.error_logs;

create policy "profiles_select_own_or_admin" on public.profiles for select using(id=auth.uid() or public.is_admin());
create policy "profiles_update_own_or_admin" on public.profiles for update using(id=auth.uid() or public.is_admin()) with check(id=auth.uid() or public.is_admin());
create policy "plans_public_read" on public.plans for select using(active=true or public.is_admin());
create policy "subscriptions_select_own_or_admin" on public.subscriptions for select using(user_id=auth.uid() or public.is_admin());

create policy "products_owner_all" on public.products for all
 using((user_id=auth.uid() and public.has_active_subscription(auth.uid())) or public.is_admin())
 with check((user_id=auth.uid() and public.has_active_subscription(auth.uid())) or public.is_admin());
create policy "campaigns_owner_all" on public.campaigns for all
 using((user_id=auth.uid() and public.has_active_subscription(auth.uid())) or public.is_admin())
 with check((user_id=auth.uid() and public.has_active_subscription(auth.uid())) or public.is_admin());
create policy "schedules_owner_all" on public.schedules for all
 using((user_id=auth.uid() and public.has_active_subscription(auth.uid())) or public.is_admin())
 with check((user_id=auth.uid() and public.has_active_subscription(auth.uid())) or public.is_admin());
create policy "integrations_owner_read" on public.integrations for select using(user_id=auth.uid() or public.is_admin());
create policy "post_logs_owner_read" on public.post_logs for select using(user_id=auth.uid() or public.is_admin());
create policy "error_logs_admin_read" on public.error_logs for select using(public.is_admin());

-- O navegador NÃO recebe INSERT/UPDATE em subscriptions, payment_events, integrations tokens ou post_logs.
-- Essas gravações ficam para Edge Functions/backend usando service role armazenado em Secrets.

create or replace function public.admin_list_users()
returns table(user_id uuid,email text,name text,is_blocked boolean,role text,plan_code text,subscription_status text,current_period_end timestamptz)
language sql stable security definer set search_path=public
as $$
 select p.id,p.email,p.name,p.is_blocked,p.role,s.plan_code,s.status,s.current_period_end
 from public.profiles p
 left join lateral (
   select s1.* from public.subscriptions s1 where s1.user_id=p.id order by s1.created_at desc limit 1
 ) s on true
 where public.is_admin()
 order by p.created_at desc;
$$;
revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated;

create or replace function public.admin_set_user_blocked(target_user uuid, blocked boolean)
returns void
language plpgsql security definer set search_path=public
as $$
begin
 if not public.is_admin() then raise exception 'Acesso negado'; end if;
 if target_user=auth.uid() then raise exception 'O administrador não pode bloquear a própria conta'; end if;
 update public.profiles set is_blocked=blocked,updated_at=now() where id=target_user;
end; $$;
revoke all on function public.admin_set_user_blocked(uuid,boolean) from public;
grant execute on function public.admin_set_user_blocked(uuid,boolean) to authenticated;

-- Permissões de tabela para authenticated (RLS continua sendo aplicado).
grant usage on schema public to authenticated,anon;
grant select on public.plans to authenticated,anon;
grant select on public.profiles to authenticated;
grant update(name,phone) on public.profiles to authenticated;
grant select on public.subscriptions to authenticated;
grant select,insert,update,delete on public.products,public.campaigns,public.schedules to authenticated;
grant select on public.integrations,public.post_logs,public.error_logs to authenticated;

-- IMPORTANTE: depois de executar, defina APENAS a sua conta como admin pelo SQL Editor:
-- update public.profiles set role='admin' where email='SEU_EMAIL_AQUI';
-- Não crie tela pública para promover usuários a admin.
