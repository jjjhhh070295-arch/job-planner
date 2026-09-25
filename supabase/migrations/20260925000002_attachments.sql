-- ============================================================
-- 첨부 (CLAUDE.md 6장 attachments)
--
-- 자격·어학 / 경험 / 지원 건에 붙인다.
-- 파일은 비공개 버킷에 두고, 볼 때마다 짧은 만료의 임시 링크를 새로 만든다.
--
-- **첨부는 공유 대상이 아니다.** 읽기 정책을 본인으로만 두고
-- shares 를 참조하지 않는다. 증명서에는 민감한 내용이 섞이기 쉽다.
-- ============================================================

create table if not exists public.attachments (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,

  -- 무엇에 붙었는지. 셋 중 딱 하나만 채운다.
  -- 따로따로 외래키를 두면 원본이 지워질 때 첨부도 DB가 알아서 지워 준다.
  spec_id        uuid references public.user_specs(id) on delete cascade,
  experience_id  uuid references public.experiences(id) on delete cascade,
  application_id uuid references public.applications(id) on delete cascade,

  kind           text not null,          -- file | link
  label          text not null,
  storage_path   text,                   -- kind=file 일 때
  url            text,                   -- kind=link 일 때
  mime_type      text,
  size_bytes     integer,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint attachments_label_len check (char_length(btrim(label)) between 1 and 100),
  constraint attachments_kind check (kind in ('file', 'link')),
  constraint attachments_one_owner check (
    (spec_id is not null)::int
    + (experience_id is not null)::int
    + (application_id is not null)::int = 1
  ),
  constraint attachments_fields check (
    (kind = 'file' and storage_path is not null and url is null)
    or (kind = 'link' and url is not null and storage_path is null)
  ),
  constraint attachments_size check (size_bytes is null or size_bytes <= 10485760)
);

create index if not exists attachments_spec_idx on public.attachments (spec_id);
create index if not exists attachments_experience_idx on public.attachments (experience_id);
create index if not exists attachments_application_idx on public.attachments (application_id);
create index if not exists attachments_user_idx on public.attachments (user_id);

alter table public.attachments enable row level security;

-- 오직 본인만. 공유 정책을 일부러 만들지 않는다.
drop policy if exists "본인 것만 읽기" on public.attachments;
create policy "본인 것만 읽기" on public.attachments
  for select using (user_id = auth.uid());

drop policy if exists "본인 것만 추가" on public.attachments;
create policy "본인 것만 추가" on public.attachments
  for insert with check (user_id = auth.uid());

drop policy if exists "본인 것만 수정" on public.attachments;
create policy "본인 것만 수정" on public.attachments
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "본인 것만 삭제" on public.attachments;
create policy "본인 것만 삭제" on public.attachments
  for delete using (user_id = auth.uid());

drop trigger if exists attachments_set_updated_at on public.attachments;
create trigger attachments_set_updated_at
  before update on public.attachments
  for each row execute function public.set_updated_at();


-- ------------------------------------------------------------
-- 비공개 버킷. 경로는 /{user_id}/...
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments',
  'attachments',
  false,
  10485760,                                  -- 10MB
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "첨부는 본인 폴더에만 올리기" on storage.objects;
create policy "첨부는 본인 폴더에만 올리기" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "첨부는 본인 폴더만 읽기" on storage.objects;
create policy "첨부는 본인 폴더만 읽기" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "첨부는 본인 폴더만 지우기" on storage.objects;
create policy "첨부는 본인 폴더만 지우기" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
