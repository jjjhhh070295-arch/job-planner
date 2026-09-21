-- ============================================================
-- AI 호출 횟수 제한 (CLAUDE.md 3장 6번: 사용자별 하루 호출 횟수 제한)
-- 서버에서만 읽고 쓴다.
-- ============================================================

-- 이 표는 "사용자 + 날짜" 조합이 곧 식별자라서 다른 표들과 달리 복합 기본키를 쓴다.
-- id 를 따로 두면 같은 날 행이 여러 개 생길 수 있어 한도 계산이 어긋난다.
create table if not exists public.ai_usage (
  user_id    uuid not null references auth.users(id) on delete cascade,
  used_on    date not null,
  count      integer not null default 0,
  updated_at timestamptz not null default now(),

  primary key (user_id, used_on),
  constraint ai_usage_count check (count >= 0)
);

alter table public.ai_usage enable row level security;
-- 정책 없음 => 브라우저에서는 접근 불가. secret 키만 읽고 쓴다.
revoke all on table public.ai_usage from anon, authenticated;


-- ------------------------------------------------------------
-- 하루 한도 안에서 1회를 소비한다. 한도를 넘으면 false.
--
-- 초대 코드와 같은 방식으로, 조회 후 증가가 아니라 upsert 한 번으로 처리한다.
-- 동시에 여러 요청이 와도 한도를 넘지 않는다.
-- 날짜는 서울 기준이다. UTC 로 세면 한국 사용자에게 밤 9시에 한도가 초기화된다.
-- ------------------------------------------------------------
create or replace function public.consume_ai_quota(
  p_user_id uuid,
  p_limit   integer
)
returns boolean
language plpgsql
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if p_limit <= 0 then
    return false;
  end if;

  insert into public.ai_usage (user_id, used_on, count, updated_at)
  values (p_user_id, v_today, 1, now())
  on conflict (user_id, used_on) do update
     set count = public.ai_usage.count + 1,
         updated_at = now()
   where public.ai_usage.count < p_limit;

  -- 삽입이나 갱신이 일어났으면 true. 한도에 걸려 아무 일도 없었으면 false.
  return found;
end;
$$;

/** 남은 횟수 확인용 (화면에 "오늘 3/30 사용" 을 보여줄 때 쓴다) */
create or replace function public.ai_quota_used_today(p_user_id uuid)
returns integer
language sql
stable
as $$
  select coalesce(
    (select count from public.ai_usage
      where user_id = p_user_id
        and used_on = (now() at time zone 'Asia/Seoul')::date),
    0);
$$;

revoke all on function public.consume_ai_quota(uuid, integer) from public, anon, authenticated;
revoke all on function public.ai_quota_used_today(uuid) from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid, integer) to service_role;
grant execute on function public.ai_quota_used_today(uuid) to service_role;
