-- ============================================================
-- 비밀번호 관리
-- 관리자가 임시 비밀번호를 발급하면 must_change_password 를 켜고,
-- 본인이 비밀번호를 바꾸면 서버가 다시 끈다.
-- ============================================================

alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

comment on column public.profiles.must_change_password is
  '관리자가 임시 비밀번호를 발급한 상태. 본인이 비밀번호를 바꿀 때까지 다른 화면을 막는다.';

-- 본인이 마음대로 끌 수 있으면 의미가 없으므로 update 권한을 주지 않는다.
-- (기존 grant 는 display_name, target_roles, target_industries 에만 걸려 있다)
