-- BOT AFILIADOS - SHOPEE AFILIADOS V1
-- Execute no SQL Editor do Supabase uma única vez.

create table if not exists public.shopee_affiliate_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  affiliate_name text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shopee_affiliate_settings enable row level security;

drop policy if exists "shopee_settings_select_own" on public.shopee_affiliate_settings;
create policy "shopee_settings_select_own"
on public.shopee_affiliate_settings for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "shopee_settings_insert_own" on public.shopee_affiliate_settings;
create policy "shopee_settings_insert_own"
on public.shopee_affiliate_settings for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "shopee_settings_update_own" on public.shopee_affiliate_settings;
create policy "shopee_settings_update_own"
on public.shopee_affiliate_settings for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
