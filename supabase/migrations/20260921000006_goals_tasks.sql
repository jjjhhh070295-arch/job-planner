-- ============================================================
-- 목표 로드맵: 목표 -> 월간 마일스톤 -> 할 일
-- ============================================================

create table if not exists public.goals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null,
  due_date   date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint goals_title_len check (char_length(btrim(title)) between 1 and 100)
);

create table if not exists public.milestones (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  goal_id      uuid references public.goals(id) on delete cascade,
  title        text not null,
  month        text,                       -- "2026-03"
  target_value integer not null default 1,
  -- 진행률을 무엇으로 셀지. manual 이면 사람이 직접 숫자를 올린다.
  auto_source  text not null default 'manual',
  auto_filter  jsonb,                      -- 2차에서 세부 조건을 넣을 자리
  manual_value integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint milestones_title_len check (char_length(btrim(title)) between 1 and 100),
  constraint milestones_month check (month is null or month ~ '^\d{4}-\d{2}$'),
  constraint milestones_target check (target_value >= 1),
  constraint milestones_manual check (manual_value >= 0),
  constraint milestones_source check (
    auto_source in ('manual', 'applications', 'tasks', 'experiences', 'specs', 'study')
  )
);

create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  milestone_id uuid references public.milestones(id) on delete set null,
  title        text not null,
  due_date     date,
  week_of      date,                       -- 그 주 월요일
  is_today     boolean not null default false,
  done         boolean not null default false,
  done_at      timestamptz,
  repeat_rule  text,                       -- 2차
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint tasks_title_len check (char_length(btrim(title)) between 1 and 200)
);

create index if not exists goals_user_idx on public.goals (user_id, due_date);
create index if not exists milestones_user_idx on public.milestones (user_id, month);
create index if not exists milestones_goal_idx on public.milestones (goal_id);
create index if not exists tasks_user_idx on public.tasks (user_id, done, due_date);
create index if not exists tasks_milestone_idx on public.tasks (milestone_id);


-- ------------------------------------------------------------
-- RLS: 본인 행만
-- ------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['goals', 'milestones', 'tasks'] loop
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
