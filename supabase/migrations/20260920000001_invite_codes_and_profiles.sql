-- ============================================================
-- 초대 코드 + 프로필(아이디 / 표시 이름)
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run 하세요.
-- 여러 번 실행해도 안전하도록 작성했습니다.
-- ============================================================

-- updated_at 을 자동으로 갱신해 주는 공통 함수
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ------------------------------------------------------------
-- 1. invite_codes — 운영자만 관리하는 초대 코드
-- ------------------------------------------------------------
create table if not exists public.invite_codes (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  max_uses   integer not null default 1,
  used_count integer not null default 0,
  expires_at timestamptz,                    -- null 이면 만료 없음
  memo       text,                           -- "친구 5명용" 같은 메모
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint invite_codes_code_upper    check (code = upper(code)),
  constraint invite_codes_code_len      check (char_length(code) between 4 and 32),
  constraint invite_codes_max_uses_pos  check (max_uses > 0),
  -- 마지막 방어선: 어떤 경로로도 사용 횟수가 한도를 넘을 수 없다
  constraint invite_codes_not_over      check (used_count >= 0 and used_count <= max_uses)
);

drop trigger if exists invite_codes_set_updated_at on public.invite_codes;
create trigger invite_codes_set_updated_at
  before update on public.invite_codes
  for each row execute function public.set_updated_at();

-- RLS 를 켜되 정책은 하나도 만들지 않는다.
-- => 브라우저(publishable 키)로는 읽기도 쓰기도 전부 차단.
--    서버의 secret 키만 RLS 를 우회해 접근한다.
alter table public.invite_codes enable row level security;
revoke all on table public.invite_codes from anon, authenticated;


-- ------------------------------------------------------------
-- 2. profiles — 아이디(username)와 표시 이름(display_name)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null unique references auth.users(id) on delete cascade,
  username          text not null unique,     -- 영문 소문자/숫자/밑줄, 로그인용
  display_name      text not null,            -- 한글 등 자유, 화면 표시용
  target_roles      text[],
  target_industries text[],
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint profiles_username_format   check (username ~ '^[a-z][a-z0-9_]{2,19}$'),
  constraint profiles_display_name_len  check (char_length(btrim(display_name)) between 1 and 20)
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "본인 프로필만 읽기" on public.profiles;
create policy "본인 프로필만 읽기" on public.profiles
  for select using (user_id = auth.uid());

drop policy if exists "본인 프로필만 수정" on public.profiles;
create policy "본인 프로필만 수정" on public.profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- insert / delete 정책은 일부러 만들지 않는다 => 계정 생성·삭제는 서버 전용.
-- 컬럼 단위 권한으로 username 은 본인도 못 바꾸게 막는다
-- (바꾸면 로그인용 이메일과 어긋나기 때문).
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name, target_roles, target_industries)
  on table public.profiles to authenticated;


-- ------------------------------------------------------------
-- 3. 초대 코드 사용 처리 — 동시에 여러 명이 가입해도 한도를 안 넘는다
-- ------------------------------------------------------------
-- 핵심: 조회 후 증가(select -> update)가 아니라 update 한 방으로 처리한다.
-- 같은 행을 두 요청이 동시에 건드리면 Postgres 가 한쪽을 잠그고,
-- 잠금이 풀린 뒤 where 조건(used_count < max_uses)을 "다시" 평가한다.
-- 그래서 한도를 넘는 쪽은 0건 갱신되고 false 를 돌려받는다.
create or replace function public.consume_invite_code(p_code text)
returns boolean
language plpgsql
as $$
declare
  v_updated integer;
begin
  update public.invite_codes
     set used_count = used_count + 1
   where code = upper(btrim(p_code))
     and used_count < max_uses
     and (expires_at is null or expires_at > now());

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

-- 코드를 먼저 소비했는데 계정 생성이 실패한 경우 되돌리기 위한 함수
create or replace function public.release_invite_code(p_code text)
returns void
language plpgsql
as $$
begin
  update public.invite_codes
     set used_count = greatest(used_count - 1, 0)
   where code = upper(btrim(p_code));
end;
$$;

-- 두 함수 모두 서버(secret 키)에서만 호출 가능하게 막는다.
-- 열어두면 누구나 코드를 하나씩 넣어보며 맞는 코드를 찾아낼 수 있다.
revoke all on function public.consume_invite_code(text) from public, anon, authenticated;
revoke all on function public.release_invite_code(text) from public, anon, authenticated;
grant execute on function public.consume_invite_code(text) to service_role;
grant execute on function public.release_invite_code(text) to service_role;


-- ------------------------------------------------------------
-- 4. 초대 코드 만들기 (필요할 때 아래 주석을 풀어 따로 실행)
-- ------------------------------------------------------------
-- insert into public.invite_codes (code, max_uses, expires_at, memo)
-- values ('FRIEND2026', 5, now() + interval '90 days', '친구 5명용');
