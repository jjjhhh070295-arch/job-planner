-- ============================================================
-- 알림 (CLAUDE.md 6장 notification_settings, push_subscriptions)
-- ============================================================

create table if not exists public.notification_settings (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  push_on          boolean not null default true,
  -- 아침 요약을 받을 시각 (서울 기준). null 이면 안 받는다.
  morning_time     time,
  -- 종류별 on/off
  morning_on       boolean not null default true,
  deadline_on      boolean not null default true,
  event_on         boolean not null default true,
  task_on          boolean not null default true,
  -- 마감 며칠 전에 알릴지
  deadline_days    integer not null default 3,
  updated_at       timestamptz not null default now(),

  constraint notification_deadline_days check (deadline_days between 0 and 30)
);

alter table public.notification_settings enable row level security;

drop policy if exists "본인 것만 읽기" on public.notification_settings;
create policy "본인 것만 읽기" on public.notification_settings
  for select using (user_id = auth.uid());

drop policy if exists "본인 것만 추가" on public.notification_settings;
create policy "본인 것만 추가" on public.notification_settings
  for insert with check (user_id = auth.uid());

drop policy if exists "본인 것만 수정" on public.notification_settings;
create policy "본인 것만 수정" on public.notification_settings
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists notification_settings_set_updated_at on public.notification_settings;
create trigger notification_settings_set_updated_at
  before update on public.notification_settings
  for each row execute function public.set_updated_at();


-- ------------------------------------------------------------
-- 브라우저 구독 정보
-- 기기마다 하나씩 생긴다. 폰과 PC 를 따로 등록할 수 있다.
-- ------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  endpoint     text not null unique,
  keys         jsonb not null,
  device_label text,
  last_sent_at timestamptz,
  -- 연속으로 실패하면 죽은 구독으로 보고 지운다.
  fail_count   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "본인 것만 읽기" on public.push_subscriptions;
create policy "본인 것만 읽기" on public.push_subscriptions
  for select using (user_id = auth.uid());

drop policy if exists "본인 것만 추가" on public.push_subscriptions;
create policy "본인 것만 추가" on public.push_subscriptions
  for insert with check (user_id = auth.uid());

drop policy if exists "본인 것만 삭제" on public.push_subscriptions;
create policy "본인 것만 삭제" on public.push_subscriptions
  for delete using (user_id = auth.uid());

drop trigger if exists push_subscriptions_set_updated_at on public.push_subscriptions;
create trigger push_subscriptions_set_updated_at
  before update on public.push_subscriptions
  for each row execute function public.set_updated_at();


-- ------------------------------------------------------------
-- 보낸 기록
-- 같은 알림을 두 번 보내지 않기 위한 장부다.
-- 예약 실행이 5분마다 돌아도 하루에 한 번만 가게 한다.
-- ------------------------------------------------------------
create table if not exists public.notification_log (
  user_id    uuid not null references auth.users(id) on delete cascade,
  -- "morning:2026-09-25", "deadline:<applicationId>", "event:<eventId>"
  dedupe_key text not null,
  sent_at    timestamptz not null default now(),

  primary key (user_id, dedupe_key)
);

create index if not exists notification_log_sent_idx
  on public.notification_log (sent_at);

alter table public.notification_log enable row level security;
-- 정책 없음 => 서버(secret 키)만 읽고 쓴다.
revoke all on table public.notification_log from anon, authenticated;
