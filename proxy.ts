import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Next.js 16 에서 middleware.ts 는 proxy.ts 로 이름이 바뀌었다.
// 하는 일은 두 가지:
//   1) 만료가 다가온 로그인 세션 쿠키를 갱신한다
//   2) 로그인 안 한 사람이 보호된 페이지에 오면 /login 으로 보낸다
// 문서 권고대로 여기서는 "1차 걸러내기"만 하고,
// 실제 데이터 보호는 DB 의 RLS 가 담당한다.

/** 로그인하지 않아도 볼 수 있는 경로 */
const PUBLIC_PATHS = ["/login", "/signup"];

export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser() 는 토큰을 Supabase 서버에 검증시킨다. getSession() 과 달리 위조할 수 없다.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some(
    (p) => path === p || path.startsWith(`${p}/`),
  );

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // api 경로는 제외한다. 가입 API 는 로그인 전에 불러야 하기 때문.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
