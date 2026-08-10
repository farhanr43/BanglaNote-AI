-- ============================================================================
-- BanglaNote AI — Auth, plans, and daily OCR credit system
-- Run via:  supabase db push
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PLANS
-- ----------------------------------------------------------------------------
create table if not exists public.plans (
  id                text primary key,
  name              text not null,
  price_bdt         integer not null default 0,
  daily_ocr_limit   integer not null default 10,
  features          jsonb  not null default '{}'::jsonb,
  is_default        boolean not null default false,
  created_at        timestamptz not null default now()
);

alter table public.plans enable row level security;

create policy "plans_public_read" on public.plans
  for select using (true);

-- Seed plans (id, name, price_bdt, daily_ocr_limit, features, is_default)
insert into public.plans (id, name, price_bdt, daily_ocr_limit, features, is_default)
values
  ('free',     'Free',     0,   10, '{"benefits": ["10 OCR credits / day", "Text export"]}'::jsonb, true),
  ('standard', 'Standard', 50,  50, '{"benefits": ["50 OCR credits / day", "DOCX export", "Priority support"]}'::jsonb, false),
  ('premium',  'Premium',  100, 100, '{"benefits": ["100 OCR credits / day", "DOCX export", "Priority support"]}'::jsonb, false)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 2. PROFILES (mirror of auth.users)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id                      uuid primary key references auth.users(id) on delete cascade,
  plan_id                 text not null default 'free' references public.plans(id),
  subscription_status     text not null default 'active',   -- active | expired | cancelled
  subscription_expires_at timestamptz,
  is_admin                boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create a profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 3. OCR USAGE LOG (source of truth for limits; daily reset is implicit:
--    a request only counts on its usage_date == current_date)
-- ----------------------------------------------------------------------------
create table if not exists public.ocr_requests (
  id                uuid primary key default gen_random_uuid(),
  request_id        text unique not null,          -- idempotency key from the client
  user_id           uuid references auth.users(id) on delete set null,
  ip_hash           text,                          -- sha-256 of the client IP (privacy)
  mode              text not null default 'ocr',
  status            text not null default 'success',
  credits_deducted  integer not null default 1,
  usage_date        date not null default current_date,
  created_at        timestamptz not null default now()
);

create index if not exists ocr_requests_user_date_idx on public.ocr_requests (user_id, usage_date);
create index if not exists ocr_requests_ip_date_idx  on public.ocr_requests (ip_hash, usage_date);

alter table public.ocr_requests enable row level security;

-- Users may view their own request history only (no direct inserts from clients)
create policy "ocr_requests_select_own" on public.ocr_requests
  for select using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 4. SUBSCRIPTION REQUESTS (admin-granted flow)
-- ----------------------------------------------------------------------------
create table if not exists public.subscription_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  plan_id     text not null references public.plans(id),
  status      text not null default 'pending',  -- pending | approved | rejected
  created_at  timestamptz not null default now()
);

-- Allow only one *pending* request per user+plan (a resolved request doesn't block re-requesting)
create unique index if not exists subscription_requests_pending_uniq
  on public.subscription_requests (user_id, plan_id)
  where status = 'pending';

alter table public.subscription_requests enable row level security;

-- Logged-in users may request an upgrade (own rows only)
create policy "subscription_requests_insert_own" on public.subscription_requests
  for insert with check (auth.uid() = user_id);

create policy "subscription_requests_select_own" on public.subscription_requests
  for select using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 5. RPC — CHECK current credits (peek, no deduction)
--    Only the edge function (service_role) may call this.
-- ----------------------------------------------------------------------------
create or replace function public.check_ocr_credits(p_user_id uuid, p_ip_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used     integer;
  v_limit    integer;
  v_plan_id  text := 'free';
  v_plan_name text := 'Free';
begin
  if auth.role() <> 'service_role' then
    raise exception 'forbidden';
  end if;

  if p_user_id is not null then
    select coalesce(pr.plan_id, 'free'), p.name
      into v_plan_id, v_plan_name
      from public.profiles pr
      left join public.plans p on p.id = pr.plan_id
      where pr.id = p_user_id;

    v_limit := coalesce(
      (select p.daily_ocr_limit from public.plans p where p.id = v_plan_id),
      10
    );

    -- Expired paid subscription falls back to the Free limit
    if v_plan_id <> 'free' then
      if (select coalesce(subscription_expires_at < now(), true)
            from public.profiles where id = p_user_id) then
        v_plan_id := 'free';
        v_plan_name := 'Free';
        v_limit := 10;
      end if;
    end if;

    select count(*) into v_used
      from public.ocr_requests
      where user_id = p_user_id and usage_date = current_date;

    return jsonb_build_object(
      'ok', true,
      'is_guest', false,
      'used', v_used,
      'limit', v_limit,
      'remaining', greatest(v_limit - v_used, 0),
      'plan_id', v_plan_id,
      'plan_name', v_plan_name
    );
  else
    select count(*) into v_used
      from public.ocr_requests
      where ip_hash = p_ip_hash and user_id is null and usage_date = current_date;

    v_limit := 3; -- guest limit
    return jsonb_build_object(
      'ok', true,
      'is_guest', true,
      'used', v_used,
      'limit', v_limit,
      'remaining', greatest(v_limit - v_used, 0),
      'plan_id', 'guest',
      'plan_name', 'Guest'
    );
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. RPC — CONSUME one credit (idempotent per request_id, re-checks limit)
--    Deduct only when the OCR request succeeded.
-- ----------------------------------------------------------------------------
create or replace function public.consume_ocr_credit(p_request_id text, p_user_id uuid, p_ip_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used     integer;
  v_limit    integer;
  v_summary  jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'forbidden';
  end if;

  -- Idempotency: never double-charge for the same request id
  if exists (select 1 from public.ocr_requests where request_id = p_request_id) then
    return jsonb_build_object(
      'ok', true,
      'deducted', false,
      'summary', public.check_ocr_credits(p_user_id, p_ip_hash)
    );
  end if;

  -- Re-check limit atomically (guards against concurrent pre-checks)
  v_summary := public.check_ocr_credits(p_user_id, p_ip_hash);
  if (v_summary->>'remaining')::integer <= 0 then
    return jsonb_build_object(
      'ok', false,
      'deducted', false,
      'error', 'limit_reached',
      'summary', v_summary
    );
  end if;

  insert into public.ocr_requests (request_id, user_id, ip_hash, mode, status, credits_deducted, usage_date)
  values (p_request_id, p_user_id, p_ip_hash, 'ocr', 'success', 1, current_date);

  return jsonb_build_object(
    'ok', true,
    'deducted', true,
    'summary', public.check_ocr_credits(p_user_id, p_ip_hash)
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. RPC — GRANT / UPDATE a subscription (admin only, via edge function)
--    Days from now; pass null to remove a paid plan (back to free).
-- ----------------------------------------------------------------------------
create or replace function public.grant_subscription(p_user_email text, p_plan_id text, p_days integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_expires timestamptz;
begin
  if auth.role() <> 'service_role' then
    raise exception 'forbidden';
  end if;

  select id into v_user_id from auth.users where email = lower(trim(p_user_email));
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'user_not_found');
  end if;

  if p_plan_id is null or p_plan_id = '' or p_plan_id = 'free' then
    update public.profiles
       set plan_id = 'free',
           subscription_status = 'cancelled',
           subscription_expires_at = null,
           updated_at = now()
     where id = v_user_id;
    return jsonb_build_object('ok', true, 'action', 'removed');
  end if;

  if not exists (select 1 from public.plans where id = p_plan_id) then
    return jsonb_build_object('ok', false, 'error', 'invalid_plan');
  end if;

  v_expires := now() + make_interval(days => p_days);

  update public.profiles
     set plan_id = p_plan_id,
         subscription_status = 'active',
         subscription_expires_at = v_expires,
         updated_at = now()
   where id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'user_id', v_user_id,
    'plan_id', p_plan_id,
    'expires_at', v_expires
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 8. RPC — LIST users + pending subscription requests (admin, via edge function)
-- ----------------------------------------------------------------------------
create or replace function public.admin_list_users()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'forbidden';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', u.id,
    'email', u.email,
    'plan_id', pr.plan_id,
    'subscription_status', pr.subscription_status,
    'subscription_expires_at', pr.subscription_expires_at,
    'created_at', u.created_at
  )), '[]'::jsonb)
  into v_rows
  from auth.users u
  left join public.profiles pr on pr.id = u.id;

  return jsonb_build_object(
    'users', v_rows,
    'pending_requests', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', sr.id,
        'user_id', sr.user_id,
        'email', u.email,
        'plan_id', sr.plan_id,
        'created_at', sr.created_at
      )), '[]'::jsonb)
      from public.subscription_requests sr
      join auth.users u on u.id = sr.user_id
      where sr.status = 'pending'
    )
  );
end;
$$;
