import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type AttemptKind = "login" | "invite";

/**
 * 한 식별자가 창(window) 안에서 허용되는 실패 횟수.
 * 친구 몇 명이 쓰는 앱이라 사람이 실수로 막히지 않을 만큼 넉넉하게 두되,
 * 기계가 코드를 훑는 건 막을 수 있는 수준으로 잡았다.
 */
const LIMITS: Record<AttemptKind, { max: number; windowMinutes: number }> = {
  login: { max: 10, windowMinutes: 15 },
  invite: { max: 10, windowMinutes: 60 },
};

/** 프록시(Vercel) 뒤에 있으므로 원래 접속자 IP 는 헤더에서 꺼낸다. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function recordAttempt(
  kind: AttemptKind,
  identifier: string,
  succeeded: boolean,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("record_auth_attempt", {
    p_kind: kind,
    p_identifier: identifier,
    p_succeeded: succeeded,
  });
  if (error) {
    // 기록에 실패해도 로그인/가입 자체를 막지는 않는다.
    console.error("[rate-limit] 시도 기록 실패", error.message);
  }
}

/**
 * 식별자들 중 하나라도 한도를 넘었으면 true.
 * 로그인은 아이디와 IP 를 함께 본다. 아이디만 보면 IP 하나로 여러 아이디를
 * 훑는 공격을 못 막고, IP 만 보면 공유 와이파이에서 애먼 사람이 막힌다.
 */
export async function isRateLimited(
  kind: AttemptKind,
  identifiers: string[],
): Promise<boolean> {
  const { max, windowMinutes } = LIMITS[kind];
  const admin = createAdminClient();

  for (const identifier of identifiers) {
    if (!identifier) continue;
    const { data, error } = await admin.rpc("recent_failure_count", {
      p_kind: kind,
      p_identifier: identifier,
      p_window_minutes: windowMinutes,
    });
    if (error) {
      console.error("[rate-limit] 실패 횟수 조회 실패", error.message);
      continue; // 조회가 안 되면 통과시킨다 (서비스가 멈추는 것보다 낫다)
    }
    if (typeof data === "number" && data >= max) {
      return true;
    }
  }

  return false;
}

export function rateLimitMessage(kind: AttemptKind): string {
  const { windowMinutes } = LIMITS[kind];
  return kind === "login"
    ? `로그인 시도가 너무 많습니다. ${windowMinutes}분 후에 다시 시도해 주세요.`
    : `가입 시도가 너무 많습니다. ${windowMinutes}분 후에 다시 시도해 주세요.`;
}
