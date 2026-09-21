-- ============================================================
-- 운영에 필요한 것들
--  - 어떤 초대 코드로 가입했는지 기록 (관리자 화면의 사용 현황)
--  - 개인정보 고지 동의 시각
--  - 앱 안에서 보내는 피드백
-- ============================================================

alter table public.profiles
  add column if not exists used_invite_code   text,
  add column if not exists privacy_agreed_at  timestamptz;

comment on column public.profiles.used_invite_code is
  '가입할 때 쓴 초대 코드. 관리자 화면에서 누가 어떤 코드로 들어왔는지 본다.';
comment on column public.profiles.privacy_agreed_at is
  '가입 시 개인정보 고지에 동의한 시각.';


-- ------------------------------------------------------------
-- 피드백
-- 본인은 넣기만 하고, 읽는 것은 운영자(secret 키)만 한다.
-- ------------------------------------------------------------
create table if not exists public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  message    text not null,
  page_path  text,
  handled    boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint feedback_message_len check (char_length(btrim(message)) between 5 and 2000)
);

create index if not exists feedback_created_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;

-- 넣기만 허용한다. 읽기 정책을 만들지 않으므로 다른 사람 것은 물론
-- 자기 것도 브라우저에서는 못 읽는다. 목록은 관리자 화면에서 secret 키로 읽는다.
drop policy if exists "본인 것만 보내기" on public.feedback;
create policy "본인 것만 보내기" on public.feedback
  for insert with check (user_id = auth.uid());

drop trigger if exists feedback_set_updated_at on public.feedback;
create trigger feedback_set_updated_at
  before update on public.feedback
  for each row execute function public.set_updated_at();
