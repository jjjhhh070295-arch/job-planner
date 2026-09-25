-- ============================================================
-- 자격증 등록번호
-- 지원서를 쓸 때마다 자격증 실물을 찾아보지 않아도 되게 적어 둔다.
-- 민감한 값은 아니지만 어깨너머로 보이기 쉬우므로 화면에서는 가려 둔다.
-- ============================================================

alter table public.user_specs
  add column if not exists license_number text;

comment on column public.user_specs.license_number is
  '자격증 등록번호(자격번호). 목록에서는 가려 두고 눌렀을 때만 보인다.';
