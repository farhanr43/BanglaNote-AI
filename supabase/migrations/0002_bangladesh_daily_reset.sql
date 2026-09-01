-- ============================================================================
-- BanglaNote AI — Fix daily credit reset to Bangladesh time (Asia/Dhaka)
-- Previous logic used current_date (UTC) so reset happened at 06:00 Dhaka.
-- This migration switches all daily counters to (now() AT TIME ZONE 'Asia/Dhaka')::date
-- so credits reset at 12:00 AM Bangladesh Time (UTC+6).
-- Run via: supabase db push
-- ============================================================================

-- Helper: Dhaka wall-clock date (stable, no DST in Bangladesh)
create or replace function public.dhaka_date()
returns date
language sql
stable
as $$ select (now() at time zone 'Asia/Dhaka')::date $$;

-- 1) Fix default for new rows
alter table public.ocr_requests
  alter column usage_date set default public.dhaka_date();

-- Backfill any rows where usage_date was set via old UTC default but created_at is available
-- (optional, keeps historic counts consistent; safe to run multiple times)
-- We only adjust rows where usage_date != dhaka_date of created_at for the last 7 days
-- to avoid touching old history unnecessarily. Comment out if you prefer to keep history as-is.
-- update public.ocr_requests
-- set usage_date = (created_at at time zone 'Asia/Dhaka')::date
-- where usage_date != (created_at at time zone 'Asia/Dhaka')::date
--   and created_at > now() - interval '30 days';

-- 2) Re-create check_ocr_credits to use Dhaka date
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
  v_today    date := public.dhaka_date();
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
      where user_id = p_user_id and usage_date = v_today;

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
      where ip_hash = p_ip_hash and user_id is null and usage_date = v_today;

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

-- 3) Re-create consume_ocr_credit to insert with Dhaka date
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
  v_today    date := public.dhaka_date();
begin
  if auth.role() <> 'service_role' then
    raise exception 'forbidden';
  end if;

  if exists (select 1 from public.ocr_requests where request_id = p_request_id) then
    return jsonb_build_object(
      'ok', true,
      'deducted', false,
      'summary', public.check_ocr_credits(p_user_id, p_ip_hash)
    );
  end if;

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
  values (p_request_id, p_user_id, p_ip_hash, 'ocr', 'success', 1, v_today);

  return jsonb_build_object(
    'ok', true,
    'deducted', true,
    'summary', public.check_ocr_credits(p_user_id, p_ip_hash)
  );
end;
$$;

comment on function public.dhaka_date is 'Bangladesh wall-clock date (Asia/Dhaka UTC+6) for daily credit reset at 12:00 AM';
comment on function public.check_ocr_credits is 'Checks daily OCR credits using Asia/Dhaka date (resets 12am BDT)';
comment on function public.consume_ocr_credit is 'Consumes 1 OCR credit using Asia/Dhaka date';
