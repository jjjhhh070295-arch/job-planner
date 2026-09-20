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
          } catch {
            // Server Component 안에서는 쿠키를 쓸 수 없어 여기로 온다.
            // 세션 갱신은 proxy.ts 가 대신 처리하므로 무시해도 안전하다.
          }
        },
      },
    },
  );
}
