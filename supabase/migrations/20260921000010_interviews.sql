-- ============================================================
-- 면접 복기
--  interviews          : 면접 회차
--  interview_questions : 회차 안의 질문. parent_id 로 꼬리질문을 잇는다.
-- ============================================================

create table if not exists public.interviews (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  application_id    uuid references public.applications(id) on delete set null,
  stage             text not null default '1차',
  type              text,                  -- 실무 / 임원 / PT / 토론 ...
  date              date,
  format            text not null default '대면',   -- 대면 / 화상 / 전화
  interviewer_count integer,
  atmosphere        text,
  overall_review    text,
  result            text not null default '대기',   -- 대기 / 합격 / 불합격
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint interviews_stage_len check (char_length(btrim(stage)) between 1 and 40),
  constraint interviews_format check (format in ('대면', '화상', '전화', '기타')),
  constraint interviews_result check (result in ('대기', '합격', '불합격')),
  constraint interviews_count check (interviewer_count is null or interviewer_count between 1 and 50)
);

create table if not exists public.interview_questions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  interview_id uuid not null references public.interviews(id) on delete cascade,
  -- 꼬리질문은 바로 앞 질문을 가리킨다. 부모가 지워지면 꼬리질문도 함께 지운다.
  parent_id    uuid references public.interview_questions(id) on delete cascade,
  question     text not null,
  my_answer    text,
  improvement  text,
  category     text,
  position     integer not null default 0,   -- 받은 순서
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint interview_questions_len check (char_length(btrim(question)) between 1 and 1000)
);

create index if not exists interviews_user_idx
  on public.interviews (user_id, date desc);
create index if not exists interviews_application_idx
  on public.interviews (application_id);
create index if not exists interview_questions_interview_idx
  on public.interview_questions (interview_id, position);

-- 한국어는 부분 일치가 잘 맞아서 trigram 인덱스를 쓴다 (CLAUDE.md 6장).
create index if not exists interview_questions_trgm_idx
  on public.interview_questions using gin (question extensions.gin_trgm_ops);


do $$
declare
  t text;
begin
  foreach t in array array['interviews', 'interview_questions'] loop
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
