-- ============================================================
-- 알림 예약 실행 (pg_cron + pg_net)
--
-- Vercel 무료 Cron 은 하루 한 번이라 "일정 10분 전" 같은 알림을 못 한다.
-- 그래서 Supabase 안의 pg_cron 이 5분마다 앱의 발송 경로를 부른다.
--   pg_cron : 정해진 주기로 SQL 을 돌린다
--   pg_net  : SQL 안에서 바깥 주소로 요청을 보낸다
--
-- 주소와 비밀 열쇠는 이 파일에 적지 않는다. (저장소에 올라가면 안 되므로)
-- 아래 함수를 Supabase SQL Editor 에서 한 번 직접 불러서 예약을 건다.
--   select public.schedule_notification_cron('https://앱주소', '비밀값');
-- ============================================================

do $$
begin
  create extension if not exists pg_cron;
exception when others then
  raise notice 'pg_cron 을 켜지 못했습니다. Supabase 대시보드 Database > Extensions 에서 켜 주세요. (%)', sqlerrm;
end
$$;

do $$
begin
  create extension if not exists pg_net with schema extensions;
exception when others then
  raise notice 'pg_net 을 켜지 못했습니다. Supabase 대시보드 Database > Extensions 에서 켜 주세요. (%)', sqlerrm;
end
$$;


-- ------------------------------------------------------------
-- 예약 걸기
-- 같은 이름의 예약이 이미 있으면 새 값으로 바꿔 단다.
-- ------------------------------------------------------------
create or replace function public.schedule_notification_cron(
  app_url     text,
  cron_secret text,
  schedule    text default '*/5 * * * *'
)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  job_name constant text := 'job-planner-notifications';
  endpoint text;
  command  text;
begin
  if app_url is null or btrim(app_url) = '' then
    raise exception '앱 주소가 필요합니다. 예: https://job-planner-orpin.vercel.app';
  end if;
  if cron_secret is null or btrim(cron_secret) = '' then
    raise exception 'CRON_SECRET 값이 필요합니다.';
  end if;

  -- 끝의 / 를 떼고 발송 경로를 붙인다.
  endpoint := rtrim(btrim(app_url), '/') || '/api/cron/notifications';

  -- 5분마다 이 SQL 이 돈다. 앱이 누가 무엇을 받을지 판단한다.
  command := format(
    $cmd$select net.http_post(
      url := %L,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || %L
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 20000
    );$cmd$,
    endpoint,
    cron_secret
  );

  if exists (select 1 from cron.job where jobname = job_name) then
    perform cron.unschedule(job_name);
  end if;

  perform cron.schedule(job_name, schedule, command);

  return format('예약 완료: %s 마다 %s 를 부릅니다.', schedule, endpoint);
end
$$;

-- 이 함수는 비밀 열쇠를 다룬다. 로그인한 사용자가 부를 수 없게 막는다.
revoke all on function public.schedule_notification_cron(text, text, text) from public;
revoke all on function public.schedule_notification_cron(text, text, text) from anon, authenticated;


-- ------------------------------------------------------------
-- 예약 상태 보기 (비밀 열쇠는 빼고 보여 준다)
-- ------------------------------------------------------------
create or replace function public.notification_cron_status()
returns table (job_name text, schedule text, active boolean, last_run timestamptz, last_status text)
language sql
security definer
set search_path = public, pg_catalog
as $$
  select
    j.jobname::text,
    j.schedule::text,
    j.active,
    r.start_time,
    r.status::text
  from cron.job j
  left join lateral (
    select start_time, status
    from cron.job_run_details d
    where d.jobid = j.jobid
    order by d.start_time desc
    limit 1
  ) r on true
  where j.jobname = 'job-planner-notifications';
$$;

revoke all on function public.notification_cron_status() from public;
revoke all on function public.notification_cron_status() from anon, authenticated;
