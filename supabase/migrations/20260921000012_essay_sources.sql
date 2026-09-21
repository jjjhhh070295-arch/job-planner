-- ============================================================
-- 자소서 초안에 쓴 경험을 출처로 남긴다 (CLAUDE.md 7장).
-- 나중에 "이 문장 어디서 나온 거지?" 를 되짚을 수 있어야 한다.
-- ============================================================

alter table public.essays
  add column if not exists source_experience_ids uuid[] not null default '{}',
  add column if not exists is_ai_draft boolean not null default false;

comment on column public.essays.source_experience_ids is
  '초안을 만들 때 프롬프트에 넣은 경험 뱅크 id 들.';
comment on column public.essays.is_ai_draft is
  'AI 채팅에서 받아 붙여넣은 초안인지. 최종본으로 바꾸면 꺼진다.';
