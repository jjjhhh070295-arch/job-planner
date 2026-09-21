-- ============================================================
-- 공부 기록
-- 타이머는 시작 시각만 DB 에 남긴다. 브라우저를 닫거나 폰을 잠가도
-- 기록이 이어지고, 다른 기기에서도 같은 타이머가 보인다.
-- ============================================================

create table if not exists public.study_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  subject      text not null,
  started_at   timestamptz not null,
  ended_at     timestamptz,                -- null 이면 아직 돌고 있는 타이머
  source       text not null default 'manual',
  capture_path text,                       -- 캡처 업로드로 만든 기록의 파일 경로
  task_id      uuid references public.tasks(id) on delete set null,
  milestone_id uuid references public.milestones(id) on delete set null,
  memo         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint study_subject_len check (char_length(btrim(subject)) between 1 and 60),
  constraint study_source check (source in ('timer', 'capture', 'manual')),
  constraint study_period check (ended_at is null or ended_at >= started_at)
);

create index if not exists study_sessions_user_idx
  on public.study_sessions (user_id, started_at desc);
create index if not exists study_sessions_milestone_idx
  on public.study_sessions (milestone_id);

-- 한 사람이 동시에 두 개의 타이머를 돌리지 못하게 막는다.
-- 앱에서 막는 것만으로는 탭을 두 개 열었을 때 새는 것을 못 막는다.
create unique index if not exists study_sessions_one_running
  on public.study_sessions (user_id)
  where ended_at is null;

alter table public.study_sessions enable row level security;

drop policy if exists "본인 것만 읽기" on public.study_sessions;
create policy "본인 것만 읽기" on public.study_sessions
  for select using (user_id = auth.uid());

drop policy if exists "본인 것만 추가" on public.study_sessions;
create policy "본인 것만 추가" on public.study_sessions
  for insert with check (user_id = auth.uid());

drop policy if exists "본인 것만 수정" on public.study_sessions;
create policy "본인 것만 수정" on public.study_sessions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "본인 것만 삭제" on public.study_sessions;
create policy "본인 것만 삭제" on public.study_sessions
  for delete using (user_id = auth.uid());

drop trigger if exists study_sessions_set_updated_at on public.study_sessions;
create trigger study_sessions_set_updated_at
  before update on public.study_sessions
  for each row execute function public.set_updated_at();
