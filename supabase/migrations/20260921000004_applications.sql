-- ============================================================
-- 지원 현황
-- 전형 단계는 CLAUDE.md 4장의 칸반 순서를 따르고, 탈락을 마지막에 더했다.
-- ============================================================

create table if not exists public.applications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  company      text not null,
  role         text,                       -- 직무
  season       text,                       -- "2026 상반기"
  status       text not null default '작성 중',
  deadline     timestamptz,                -- 자소서 마감. 시각까지 중요해서 date 가 아니다
  posting_url  text,
  posting_text text,                       -- 붙여넣은 공고 원문. AI 파싱 입력으로 쓴다
  requirements jsonb,                      -- 어학 요건 등 파싱 결과
  memo         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint applications_company_len check (char_length(btrim(company)) between 1 and 100),
  constraint applications_status check (
    status in ('작성 중', '제출', '서류 합격', '면접', '최종 합격', '탈락')
  )
);

create index if not exists applications_user_status_idx
  on public.applications (user_id, status, deadline);

alter table public.applications enable row level security;

drop policy if exists "본인 것만 읽기" on public.applications;
create policy "본인 것만 읽기" on public.applications
  for select using (user_id = auth.uid());

drop policy if exists "본인 것만 추가" on public.applications;
create policy "본인 것만 추가" on public.applications
  for insert with check (user_id = auth.uid());

drop policy if exists "본인 것만 수정" on public.applications;
create policy "본인 것만 수정" on public.applications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "본인 것만 삭제" on public.applications;
create policy "본인 것만 삭제" on public.applications
  for delete using (user_id = auth.uid());

drop trigger if exists applications_set_updated_at on public.applications;
create trigger applications_set_updated_at
  before update on public.applications
  for each row execute function public.set_updated_at();
