import { NextResponse } from "next/server";

import {
  clientIp,
  isRateLimited,
  rateLimitMessage,
  recordAttempt,
} from "@/lib/auth/rate-limit";
import { normalizeUsername, usernameToEmail } from "@/lib/auth/username";
import { createClient } from "@/lib/supabase/server";

// 로그인을 브라우저에서 직접 하지 않고 이 경로를 거치게 만든 이유는
// 실패 횟수를 서버에서 세야 무차별 대입을 막을 수 있기 때문이다.

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "요청 형식이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const username = normalizeUsername(String(body.username ?? ""));
  const password = String(body.password ?? "");
  const ip = clientIp(request);

  const identifiers = [`user:${username}`, `ip:${ip}`];

  if (await isRateLimited("login", identifiers)) {
    return NextResponse.json(
      { message: rateLimitMessage("login") },
      { status: 429 },
    );
  }

  if (!username || !password) {
    return NextResponse.json(
      { message: "아이디와 비밀번호를 입력해 주세요." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });

  if (error) {
    for (const identifier of identifiers) {
      await recordAttempt("login", identifier, false);
    }
    // 아이디가 없는 건지 비밀번호가 틀린 건지 구분해 주지 않는다.
    return NextResponse.json(
      { message: "아이디 또는 비밀번호가 올바르지 않습니다." },
      { status: 401 },
    );
  }

  // 성공을 기록해 두면 그 이후의 실패만 세게 되어 카운터가 초기화된다.
  for (const identifier of identifiers) {
    await recordAttempt("login", identifier, true);
  }

  return NextResponse.json({ ok: true });
}
