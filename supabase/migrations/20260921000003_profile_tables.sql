-- ============================================================
-- 프로필 재료: 학력 / 자격·어학 / 경험 뱅크
-- 전부 본인 행만 읽고 쓸 수 있다.
-- ============================================================

-- ------------------------------------------------------------
-- 학력
-- CLAUDE.md 6장의 start, end 는 SQL 예약어라 start_date, end_date 로 바꿨다.
-- ------------------------------------------------------------
create table if not exists public.education (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  school      text not null,
  major       text,
  degree      text,                 -- 고졸 / 전문학사 / 학사 / 석사 / 박사
  start_date  date,
  end_date    date,                 -- 재학 중이면 비움
  gpa         text,                 -- "3.8/4.5" 처럼 만점을 같이 적을 수 있게 텍스트
  key_courses text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint education_school_len check (char_length(btrim(school)) between 1 and 100),
  constraint education_period check (end_date is null or start_date is null or end_date >= start_date)
);

-- ------------------------------------------------------------
-- 자격증 · 어학
-- ------------------------------------------------------------
create table if not exists public.user_specs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  name           text not null,
  category       text not null,     -- 어학 / 자격증 / 기타
  status         text not null default '보유',  -- 보유 / 준비중 / 목표
  score_or_grade text,
  acquired_date  date,
  expiry_date    date,              -- 어학 점수 유효기간. 대시보드 D-day 경고에 쓴다
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint user_specs_name_len check (char_length(btrim(name)) between 1 and 100),
  constraint user_specs_category check (category in ('어학', '자격증', '기타')),
  constraint user_specs_status check (status in ('보유', '준비중', '목표')),
  constraint user_specs_dates check (expiry_date is null or acquired_date is null or expiry_date >= acquired_date)
);

-- ------------------------------------------------------------
-- 경험 뱅크 (자소서 재료)
-- ------------------------------------------------------------
create table if not exists public.experiences (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  org          text,
  period_start date,
  period_end   date,
  role         text,
  situation    text,                -- 어떤 상황이었나
  action       text,                -- 무엇을 했나
  result       text,                -- 어떤 결과가 났나
  tags         text[] not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint experiences_title_len check (char_length(btrim(title)) between 1 and 100),
  constraint experiences_period check (period_end is null or period_start is null or period_end >= period_start)
);

create index if not exists education_user_idx on public.education (user_id, start_date desc);
create index if not exists user_specs_user_idx on public.user_specs (user_id, expiry_date);
create index if not exists experiences_user_idx on public.experiences (user_id, period_start desc);


-- ------------------------------------------------------------
-- RLS: 본인 행만. 세 테이블 모두 같은 규칙.
-- ------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['education', 'user_specs', 'experiences'] loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "본인 것만 읽기" on public.%I', t);
    execute format(
      'create policy "본인 것만 읽기" on public.%I for select using (user_id = auth.uid())', t);

    execute format('drop policy if exists "본인 것만 추가" on public.%I', t);
    execute format(
      'create policy "본인 것만 추가" on public.%I for insert with check (user_id = auth.uid())', t);

    execute format('drop policy if exists "본인 것만 수정" on public.%I', t);
    execute format(
      'create policy "본인 것만 수정" on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid())', t);

    execute format('drop policy if exists "본인 것만 삭제" on public.%I', t);
    execute format(
      'create policy "본인 것만 삭제" on public.%I for delete using (user_id = auth.uid())', t);

    execute format('drop trigger if exists %I_set_updated_at on public.%I', t, t);
    execute format(
      'create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end
$$;
