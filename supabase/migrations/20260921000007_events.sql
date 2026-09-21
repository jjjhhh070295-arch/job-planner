-- ============================================================
-- 개인 일정 (시험일, 면접, 그 밖의 일정)
-- 캘린더는 이 표와 함께 applications.deadline, tasks.due_date 를 모아 보여 준다.
-- ============================================================

create table if not exists public.events (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  title             text not null,
  kind              text not null default '개인',
  start_at          timestamptz not null,
  end_at            timestamptz,
  all_day           boolean not null default true,
  memo              text,
  remind_before_min integer,          -- 2차 알림에서 사용
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint events_title_len check (char_length(btrim(title)) between 1 and 100),
  constraint events_kind check (kind in ('개인', '시험', '면접', '기타')),
  constraint events_period check (end_at is null or end_at >= start_at),
  constraint events_remind check (remind_before_min is null or remind_before_min between 0 and 10080)
);

create index if not exists events_user_start_idx on public.events (user_id, start_at);

alter table public.events enable row level security;

drop policy if exists "본인 것만 읽기" on public.events;
create policy "본인 것만 읽기" on public.events
  for select using (user_id = auth.uid());

drop policy if exists "본인 것만 추가" on public.events;
create policy "본인 것만 추가" on public.events
  for insert with check (user_id = auth.uid());

drop policy if exists "본인 것만 수정" on public.events;
create policy "본인 것만 수정" on public.events
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "본인 것만 삭제" on public.events;
create policy "본인 것만 삭제" on public.events
  for delete using (user_id = auth.uid());

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();
