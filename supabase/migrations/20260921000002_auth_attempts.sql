-- ============================================================
-- 로그인 / 초대 코드 시도 기록 — 무차별 대입 제한용
-- 서버에서만 읽고 쓴다. 브라우저는 접근할 수 없다.
-- ============================================================

create table if not exists public.auth_attempts (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null,
  identifier   text not null,          -- 아이디 또는 IP 주소
  succeeded    boolean not null default false,
  attempted_at timestamptz not null default now(),

  constraint auth_attempts_kind_check check (kind in ('login', 'invite'))
);

create index if not exists auth_attempts_lookup_idx
  on public.auth_attempts (kind, identifier, attempted_at desc);

alter table public.auth_attempts enable row level security;
-- 정책 없음 => publishable 키로는 접근 불가. secret 키만 읽고 쓴다.
revoke all on table public.auth_attempts from anon, authenticated;


-- ------------------------------------------------------------
-- 최근 실패 횟수. 마지막 성공 이후의 실패만 센다.
-- (성공하면 카운터가 사실상 초기화되는 효과. 행을 지우지 않아도 된다.)
-- ------------------------------------------------------------
create or replace function public.recent_failure_count(
  p_kind           text,
  p_identifier     text,
  p_window_minutes integer
)
returns integer
language sql
stable
as $$
  select count(*)::int
    from public.auth_attempts a
   where a.kind = p_kind
     and a.identifier = p_identifier
     and a.succeeded = false
     and a.attempted_at > now() - make_interval(mins => p_window_minutes)
     and a.attempted_at > coalesce(
           (select max(s.attempted_at)
              from public.auth_attempts s
             where s.kind = p_kind
               and s.identifier = p_identifier
               and s.succeeded),
           'epoch'::timestamptz
         );
$$;


create or replace function public.record_auth_attempt(
  p_kind       text,
  p_identifier text,
  p_succeeded  boolean
)
returns void
language sql
as $$
  insert into public.auth_attempts (kind, identifier, succeeded)
  values (p_kind, p_identifier, p_succeeded);
$$;


-- 서버(secret 키)에서만 부를 수 있게 막는다.
revoke all on function public.recent_failure_count(text, text, integer)
  from public, anon, authenticated;
revoke all on function public.record_auth_attempt(text, text, boolean)
  from public, anon, authenticated;

grant execute on function public.recent_failure_count(text, text, integer)
  to service_role;
grant execute on function public.record_auth_attempt(text, text, boolean)
  to service_role;
