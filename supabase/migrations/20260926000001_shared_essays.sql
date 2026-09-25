-- ============================================================
-- 공용 자소서
--
-- 앱을 쓰지 않는 사람들이 운영자에게 공유해 준 자소서를 모아 두는 곳이다.
-- 내 자소서(essays)와 완전히 다른 표다. 대시보드 통계에도 섞이지 않는다.
--
-- 사람을 특정할 수 있는 칸은 아예 만들지 않는다 (이름·학교·연락처).
-- 출처 메모는 운영자만 보는 칸이고, 화면에서도 사용자에게 내려보내지 않는다.
--
-- 권한
--   읽기 : 로그인한 사람이 "전체 공개" 인 것만
--   쓰기 : 정책을 하나도 만들지 않는다 => 일반 사용자는 전부 거절된다.
--          관리자 화면만 service_role 키로 쓴다 (isAdminUsername 으로 한 번 더 확인).
-- ============================================================

create extension if not exists pg_trgm with schema extensions;

create table if not exists public.shared_essays (
  id          uuid primary key default gen_random_uuid(),

  company     text not null,
  role        text,
  season      text,

  question    text not null,
  char_limit  integer,
  answer      text not null,
  category    text,

  -- 서류 합격 / 최종 합격 / 불합격 / 모름
  result      text not null default '모름',

  -- 운영자만 보는 칸. 어디서 받았는지 적어 둔다.
  source_memo text,

  -- 작성자에게 전체 공개 동의를 받았는지. 이게 있어야 전체 공개가 가능하다.
  consent_confirmed boolean not null default false,
  -- admin = 운영자만, all = 로그인한 전체 사용자
  visibility  text not null default 'admin',

  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint shared_essays_company_len check (char_length(btrim(company)) between 1 and 100),
  constraint shared_essays_question_len check (char_length(btrim(question)) between 1 and 500),
  constraint shared_essays_answer_len check (char_length(btrim(answer)) between 1 and 20000),
  constraint shared_essays_char_limit check (char_limit is null or char_limit between 1 and 20000),
  constraint shared_essays_result check (result in ('서류 합격', '최종 합격', '불합격', '모름')),
  constraint shared_essays_visibility check (visibility in ('admin', 'all')),
  -- 동의를 받지 않았으면 전체 공개로 둘 수 없다. DB 가 직접 막는다.
  constraint shared_essays_consent check (visibility = 'admin' or consent_confirmed)
);

create index if not exists shared_essays_visible_idx
  on public.shared_essays (visibility, created_at desc);
create index if not exists shared_essays_company_idx
  on public.shared_essays (company);

-- 한국어는 부분 일치가 잘 맞는다 (CLAUDE.md 6장).
create index if not exists shared_essays_question_trgm_idx
  on public.shared_essays using gin (question extensions.gin_trgm_ops);
create index if not exists shared_essays_answer_trgm_idx
  on public.shared_essays using gin (answer extensions.gin_trgm_ops);
create index if not exists shared_essays_company_trgm_idx
  on public.shared_essays using gin (company extensions.gin_trgm_ops);

alter table public.shared_essays enable row level security;

drop policy if exists "전체 공개된 것만 읽기" on public.shared_essays;
create policy "전체 공개된 것만 읽기" on public.shared_essays
  for select using (visibility = 'all' and auth.uid() is not null);

-- 추가·수정·삭제 정책은 일부러 만들지 않는다.
-- 정책이 없으면 RLS 가 전부 막는다. 관리자 화면만 service_role 로 지나간다.
revoke insert, update, delete on table public.shared_essays from anon, authenticated;

drop trigger if exists shared_essays_set_updated_at on public.shared_essays;
create trigger shared_essays_set_updated_at
  before update on public.shared_essays
  for each row execute function public.set_updated_at();
