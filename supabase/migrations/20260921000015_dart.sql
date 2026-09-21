-- ============================================================
-- 기업분석 (DART 오픈API)
--
-- DART 는 기업 이름으로 바로 조회할 수 없고 고유번호(corp_code)가 필요하다.
-- 고유번호 목록은 zip 파일 하나로만 받을 수 있어서, 상장사만 추려 여기 담아 둔다.
-- (전체는 10만 건이 넘지만 상장사는 3천 건 안쪽이라 가볍다)
-- ============================================================

create table if not exists public.dart_corps (
  corp_code   text primary key,
  corp_name   text not null,
  stock_code  text,
  modify_date text,
  updated_at  timestamptz not null default now()
);

create index if not exists dart_corps_name_idx on public.dart_corps (corp_name);
create index if not exists dart_corps_name_trgm_idx
  on public.dart_corps using gin (corp_name extensions.gin_trgm_ops);

alter table public.dart_corps enable row level security;

-- 공개 정보라 로그인하면 누구나 읽는다. 채우는 것은 운영자만.
drop policy if exists "로그인하면 누구나 읽기" on public.dart_corps;
create policy "로그인하면 누구나 읽기" on public.dart_corps
  for select to authenticated using (true);

revoke insert, update, delete on table public.dart_corps from anon, authenticated;


-- ------------------------------------------------------------
-- 조회 결과 하루 캐시
-- 같은 기업을 여러 번 열어 봐도 DART 에는 하루 한 번만 물어본다.
-- ------------------------------------------------------------
create table if not exists public.dart_cache (
  cache_key  text not null,
  fetched_on date not null,
  payload    jsonb not null,
  created_at timestamptz not null default now(),

  primary key (cache_key, fetched_on)
);

alter table public.dart_cache enable row level security;
-- 정책 없음 => 서버(secret 키)만 읽고 쓴다.
revoke all on table public.dart_cache from anon, authenticated;
