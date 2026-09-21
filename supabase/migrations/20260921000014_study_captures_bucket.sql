-- ============================================================
-- 공부 시간 캡처 이미지 저장소
-- CLAUDE.md 3장 3번: 버킷은 private, 경로는 /{user_id}/..., 본인 폴더만 접근.
-- 화면에 보여 줄 때는 매번 짧은 만료의 signed URL 을 쓴다.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'study-captures',
  'study-captures',
  false,
  3145728,                                  -- 3MB. 브라우저에서 줄여 올리므로 넉넉하다
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- 경로 첫 칸이 자기 user_id 인 파일만 다룰 수 있다.
-- storage.foldername('abc/def.jpg') = {abc}

drop policy if exists "본인 폴더에만 올리기" on storage.objects;
create policy "본인 폴더에만 올리기" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'study-captures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "본인 폴더만 읽기" on storage.objects;
create policy "본인 폴더만 읽기" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'study-captures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "본인 폴더만 지우기" on storage.objects;
create policy "본인 폴더만 지우기" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'study-captures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
