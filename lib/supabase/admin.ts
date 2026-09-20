import "server-only"; // 이 파일이 브라우저 코드에 딸려가면 빌드가 실패하도록 막는 장치

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * secret(service_role) 키를 쓰는 관리자 클라이언트. RLS 를 전부 우회한다.
 * 계정 생성, 초대 코드 소비처럼 서버에서만 해야 하는 작업에만 쓴다.
 * CLAUDE.md 3장 2번: 이 키는 절대 브라우저로 나가면 안 된다.
 */
export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY 가 없습니다. .env.local 을 확인하세요.",
    );
  }

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/** .env.local 의 ADMIN_USERNAMES(쉼표 구분) 에 들어 있는 아이디인지 확인한다. */
export function isAdminUsername(username: string): boolean {
  const list = (process.env.ADMIN_USERNAMES ?? "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(username.trim().toLowerCase());
}
