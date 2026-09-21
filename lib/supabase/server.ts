import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * 서버(Server Component / Route Handler)에서 쓰는 Supabase 클라이언트.
 * 로그인한 사용자 자격으로 동작하므로 RLS 가 그대로 적용된다.
 * Next.js 16 에서 cookies() 는 비동기라 await 가 필요하다.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch (error) {
            // Server Component 안에서는 쿠키를 쓸 수 없어 여기로 온다.
            // 세션 갱신은 proxy.ts 가 대신 처리하므로 그 경우는 무시해도 안전하다.
            // 다만 Route Handler 에서 나면 로그인이 안 되는 진짜 문제이므로 남겨 둔다.
            console.warn(
              "[supabase/server] 쿠키 쓰기 실패:",
              error instanceof Error ? error.message : error,
            );
          }
        },
      },
    },
  );
}

/**
 * 로그인한 사람의 클라이언트와 id 를 함께 돌려준다.
 *
 * 공유 기능이 생기면서 essays·interviews·applications 의 읽기 정책이
 * "내 것 또는 공유받은 것" 으로 넓어졌다. 내 목록 화면은 남의 것이 섞이면
 * 안 되므로 조회할 때 user_id 를 직접 걸어 준다.
 */
export async function createOwnClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? "" };
}
