-- ============================================================
-- 자소서
-- 검색은 한국어 부분 일치가 중요해서 pg_trgm 인덱스를 쓴다 (CLAUDE.md 6장).
-- ============================================================

create extension if not exists pg_trgm with schema extensions;

create table if not exists public.essays (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  -- 기업이 지워져도 자소서는 라이브러리에 남겨 둔다. 재활용 자산이기 때문.
  application_id uuid references public.applications(id) on delete set null,
  question       text not null,
  char_limit     integer,
  category       text,
  answer         text,
  is_final       boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint essays_question_len check (char_length(btrim(question)) between 1 and 500),
  constraint essays_char_limit check (char_limit is null or char_limit between 1 and 20000)
);

create index if not exists essays_user_idx on public.essays (user_id, created_at desc);
create index if not exists essays_application_idx on public.essays (application_id);

-- 부분 일치 검색용 trigram 인덱스
create index if not exists essays_question_trgm_idx
  on public.essays using gin (question extensions.gin_trgm_ops);
create index if not exists essays_answer_trgm_idx
  on public.essays using gin (answer extensions.gin_trgm_ops);

alter table public.essays enable row level security;

drop policy if exists "본인 것만 읽기" on public.essays;
create policy "본인 것만 읽기" on public.essays
  for select using (user_id = auth.uid());

drop policy if exists "본인 것만 추가" on public.essays;
create policy "본인 것만 추가" on public.essays
  for insert with check (user_id = auth.uid());

drop policy if exists "본인 것만 수정" on public.essays;
create policy "본인 것만 수정" on public.essays
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "본인 것만 삭제" on public.essays;
create policy "본인 것만 삭제" on public.essays
  for delete using (user_id = auth.uid());

drop trigger if exists essays_set_updated_at on public.essays;
create trigger essays_set_updated_at
  before update on public.essays
  for each row execute function public.set_updated_at();
