-- ============================================================
-- 공용 시험 일정 (CLAUDE.md 6장의 exams)
-- 모두가 읽지만 쓰는 것은 운영자뿐이다. 이 앱에서 유일한 공용 테이블.
-- ============================================================

create table if not exists public.exams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,            -- SQLD, 토익, ADsP ...
  category    text not null default '자격증',
  round       text,                     -- "2026년 제1회"
  reg_start   date,                     -- 접수 시작
  reg_end     date,                     -- 접수 마감
  exam_date   date,
  result_date date,
  memo        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint exams_name_len check (char_length(btrim(name)) between 1 and 60),
  constraint exams_category check (category in ('자격증', '어학', '기타')),
  constraint exams_reg_period check (reg_end is null or reg_start is null or reg_end >= reg_start)
);

create index if not exists exams_date_idx on public.exams (exam_date);
create unique index if not exists exams_unique_round
  on public.exams (name, coalesce(round, ''));

alter table public.exams enable row level security;

-- 읽기는 로그인한 사람 모두에게 연다. 공개 정보이고, 모두가 같은 일정을 본다.
drop policy if exists "로그인하면 누구나 읽기" on public.exams;
create policy "로그인하면 누구나 읽기" on public.exams
  for select to authenticated using (true);

-- 쓰기 정책은 만들지 않는다 => 운영자(secret 키)만 넣고 고칠 수 있다.
revoke insert, update, delete on table public.exams from anon, authenticated;

drop trigger if exists exams_set_updated_at on public.exams;
create trigger exams_set_updated_at
  before update on public.exams
  for each row execute function public.set_updated_at();


-- 목표로 삼은 시험을 자격·어학 항목에 이어 둔다.
-- 시험이 지워져도 내 스펙 기록은 남아야 하므로 set null.
alter table public.user_specs
  add column if not exists target_exam_id uuid references public.exams(id) on delete set null;

comment on column public.user_specs.target_exam_id is
  '준비 중인 시험. 접수 시작·마감과 시험일이 캘린더에 뜬다.';
