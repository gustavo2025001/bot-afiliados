-- Bot Afiliados Premium V5.3 - Instagram API with Instagram Login
-- Execute UMA vez no SQL Editor do Supabase.
-- Aditivo: não apaga as tabelas existentes.

create table if not exists public.instagram_oauth_states (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.instagram_oauth_states enable row level security;
-- Sem policies: somente Edge Functions com service_role.

create table if not exists public.instagram_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  instagram_user_id text not null,
  username text,
  account_type text,
  access_token_enc text not null,
  token_expires_at timestamptz,
  graph_version text not null default 'v25.0',
  status text not null default 'connected' check(status in ('connected','error','disconnected')),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.instagram_credentials enable row level security;
-- Sem policies: token nunca é lido pelo navegador.

create index if not exists instagram_credentials_status_idx
  on public.instagram_credentials(status,updated_at desc);
create index if not exists instagram_oauth_states_exp_idx
  on public.instagram_oauth_states(expires_at);

create or replace function public.reserve_instagram_share(target_product uuid)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  uid uuid := auth.uid();
  d date := (now() at time zone 'America/Sao_Paulo')::date;
  pcode text; lim integer; unlimited boolean := false; used_now integer := 0;
  title_now text; log_id uuid;
begin
  if uid is null then raise exception 'Não autenticado'; end if;
  select title into title_now from public.products where id=target_product and (user_id=uid or public.is_admin());
  if title_now is null then raise exception 'Produto não encontrado'; end if;

  if public.is_admin() then unlimited:=true; pcode:='admin';
  else
    select s.plan_code,
      case when coalesce((p.limits->>'unlimited')::boolean,false) then null else nullif(p.limits->>'daily_shares','')::integer end,
      coalesce((p.limits->>'unlimited')::boolean,false)
    into pcode,lim,unlimited
    from public.subscriptions s join public.plans p on p.code=s.plan_code join public.profiles pr on pr.id=s.user_id
    where s.user_id=uid and s.status='active' and pr.is_blocked=false
      and (s.current_period_end is null or s.current_period_end>now())
    order by s.created_at desc limit 1;
    if pcode is null then raise exception 'Assinatura ativa necessária'; end if;
  end if;

  insert into public.daily_usage(user_id,usage_date,shares) values(uid,d,0) on conflict do nothing;
  select shares into used_now from public.daily_usage where user_id=uid and usage_date=d for update;
  if not unlimited and used_now>=lim then raise exception 'Limite diário atingido'; end if;
  update public.daily_usage set shares=shares+1,updated_at=now() where user_id=uid and usage_date=d returning shares into used_now;

  insert into public.post_logs(user_id,provider,status,response_meta)
  values(uid,'instagram','queued',jsonb_build_object('mode','instagram_graph_api','product_id',target_product,'title',title_now,'usage_date',d))
  returning id into log_id;

  return jsonb_build_object('ok',true,'log_id',log_id,'used',used_now,'limit',lim,'unlimited',unlimited,'plan',pcode);
end; $$;
revoke all on function public.reserve_instagram_share(uuid) from public;
grant execute on function public.reserve_instagram_share(uuid) to authenticated;

create or replace function public.complete_instagram_share(target_log uuid,target_external_id text,target_meta jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path=public
as $$
declare uid uuid:=auth.uid(); pid uuid;
begin
  if uid is null then raise exception 'Não autenticado'; end if;
  select nullif(response_meta->>'product_id','')::uuid into pid from public.post_logs
   where id=target_log and user_id=uid and provider='instagram' and status='queued';
  if not found then raise exception 'Registro de publicação não encontrado'; end if;
  update public.post_logs set status='sent',external_id=target_external_id,response_meta=response_meta||coalesce(target_meta,'{}'::jsonb)
   where id=target_log and user_id=uid;
  if pid is not null then update public.products set queued=false,updated_at=now() where id=pid and user_id=uid; end if;
end; $$;
revoke all on function public.complete_instagram_share(uuid,text,jsonb) from public;
grant execute on function public.complete_instagram_share(uuid,text,jsonb) to authenticated;

create or replace function public.fail_instagram_share(target_log uuid,target_error text,target_meta jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path=public
as $$
declare uid uuid:=auth.uid(); d date; pid uuid;
begin
  if uid is null then raise exception 'Não autenticado'; end if;
  select nullif(response_meta->>'usage_date','')::date,nullif(response_meta->>'product_id','')::uuid into d,pid
   from public.post_logs where id=target_log and user_id=uid and provider='instagram' and status='queued' for update;
  if not found then return; end if;
  update public.post_logs set status='failed',error_message=left(coalesce(target_error,'Falha na publicação'),1000),response_meta=response_meta||coalesce(target_meta,'{}'::jsonb)
   where id=target_log and user_id=uid;
  if d is not null then update public.daily_usage set shares=greatest(0,shares-1),updated_at=now() where user_id=uid and usage_date=d; end if;
  if pid is not null then update public.products set queued=true,updated_at=now() where id=pid and user_id=uid; end if;
end; $$;
revoke all on function public.fail_instagram_share(uuid,text,jsonb) from public;
grant execute on function public.fail_instagram_share(uuid,text,jsonb) to authenticated;
