-- ============================================================
-- 공유 권한 (CLAUDE.md 6장)
--  - 지원 건 하나 또는 전체
--  - 자소서 / 면접 / 둘 다 를 나눠서
--  - 읽기 전용. 쓰기·수정·삭제는 언제나 본인만
--  - 준 사람이 언제든 회수 가능
--
-- 프로필, 공부 기록, 목표·할 일은 공유 대상이 아니다.
-- ============================================================

create table if not exists public.shares (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete cascade,
  grantee_id     uuid not null references auth.users(id) on delete cascade,
  -- null 이면 내 지원 전체
  application_id uuid references public.applications(id) on delete cascade,
  scope          text not null default 'both',
  memo           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint shares_scope check (scope in ('essays', 'interviews', 'both')),
  constraint shares_not_self check (owner_id <> grantee_id)
);

-- 같은 사람에게 같은 대상을 두 번 주지 못하게 막는다.
create unique index if not exists shares_unique
  on public.shares (owner_id, grantee_id, coalesce(application_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index if not exists shares_grantee_idx on public.shares (grantee_id);

alter table public.shares enable row level security;

-- 준 사람과 받은 사람 모두 "어떤 공유가 있는지" 는 볼 수 있어야 한다.
drop policy if exists "내가 주거나 받은 공유만 읽기" on public.shares;
create policy "내가 주거나 받은 공유만 읽기" on public.shares
  for select using (owner_id = auth.uid() or grantee_id = auth.uid());

-- 만들고 고치고 지우는 것은 준 사람만.
drop policy if exists "내가 주는 공유만 추가" on public.shares;
create policy "내가 주는 공유만 추가" on public.shares
  for insert with check (owner_id = auth.uid());

drop policy if exists "내가 주는 공유만 수정" on public.shares;
create policy "내가 주는 공유만 수정" on public.shares
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "내가 주는 공유만 회수" on public.shares;
create policy "내가 주는 공유만 회수" on public.shares
  for delete using (owner_id = auth.uid());

drop trigger if exists shares_set_updated_at on public.shares;
create trigger shares_set_updated_at
  before update on public.shares
  for each row execute function public.set_updated_at();


-- ------------------------------------------------------------
-- 읽기 정책 확장
-- 쓰기·수정·삭제 정책은 그대로 둔다 (본인만).
-- ------------------------------------------------------------

drop policy if exists "본인 것만 읽기" on public.essays;
drop policy if exists "본인 것 또는 공유받은 것 읽기" on public.essays;
create policy "본인 것 또는 공유받은 것 읽기" on public.essays
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.shares s
      where s.owner_id = essays.user_id
        and s.grantee_id = auth.uid()
        and s.scope in ('essays', 'both')
        and (s.application_id is null or s.application_id = essays.application_id)
    )
  );

drop policy if exists "본인 것만 읽기" on public.interviews;
drop policy if exists "본인 것 또는 공유받은 것 읽기" on public.interviews;
create policy "본인 것 또는 공유받은 것 읽기" on public.interviews
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.shares s
      where s.owner_id = interviews.user_id
        and s.grantee_id = auth.uid()
        and s.scope in ('interviews', 'both')
        and (s.application_id is null or s.application_id = interviews.application_id)
    )
  );

-- 질문은 회차를 따라간다.
drop policy if exists "본인 것만 읽기" on public.interview_questions;
drop policy if exists "본인 것 또는 공유받은 것 읽기" on public.interview_questions;
create policy "본인 것 또는 공유받은 것 읽기" on public.interview_questions
  for select using (
    user_id = auth.uid()
    or exists (
      select 1
        from public.interviews i
        join public.shares s on s.owner_id = i.user_id
       where i.id = interview_questions.interview_id
         and s.grantee_id = auth.uid()
         and s.scope in ('interviews', 'both')
         and (s.application_id is null or s.application_id = i.application_id)
    )
  );

-- 공유받은 자소서·면접이 어느 기업 것인지 보려면 지원 건도 읽을 수 있어야 한다.
drop policy if exists "본인 것만 읽기" on public.applications;
drop policy if exists "본인 것 또는 공유받은 것 읽기" on public.applications;
create policy "본인 것 또는 공유받은 것 읽기" on public.applications
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.shares s
      where s.owner_id = applications.user_id
        and s.grantee_id = auth.uid()
        and (s.application_id is null or s.application_id = applications.id)
    )
  );
