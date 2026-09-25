"use server";

import { getCurrentProfile } from "@/lib/auth/current-user";
import type { FormState } from "@/lib/form-state";
import { isAdminUsername } from "@/lib/supabase/admin";

/* ============================================================
   외부 API 키가 실제로 동작하는지 눌러서 확인한다.

   일부러 lib/ai.ts 의 callAI() 를 쓰지 않는다.
   그쪽은 사용자 하루 한도를 깎는데, 점검 때문에 한도를 쓰면 안 된다.
   여기서는 가장 가벼운 호출로 키가 살아 있는지만 본다.
   키 값은 어떤 경우에도 화면이나 로그에 남기지 않는다.
   ============================================================ */

async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile || !isAdminUsername(profile.username)) {
    throw new Error("권한이 없습니다.");
  }
}

export async function testGemini(
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return { ok: false, message: "GEMINI_API_KEY 가 서버에 없습니다." };
  }

  try {
    // 모델 목록 조회는 생성 요청이 아니라 사실상 비용이 없다.
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models",
      {
        headers: { "x-goog-api-key": key },
        signal: AbortSignal.timeout(20_000),
      },
    );
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        (body as { error?: { message?: string } })?.error?.message ??
        `HTTP ${response.status}`;
      return { ok: false, message: `Gemini 오류: ${message.slice(0, 160)}` };
    }

    const models = (body as { models?: { name: string }[] })?.models ?? [];
    const target = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
    const has = models.some((m) => m.name === `models/${target}`);

    return {
      ok: true,
      message: has
        ? `정상. 쓸 수 있는 모델 ${models.length}개, 이 앱이 쓰는 ${target} 도 사용 가능합니다.`
        : `키는 정상이지만 ${target} 을(를) 쓸 수 없습니다. GEMINI_MODEL 을 확인해 주세요.`,
    };
  } catch {
    return { ok: false, message: "Gemini 서버에 연결하지 못했습니다." };
  }
}

export async function testDart(
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const key = process.env.DART_API_KEY;
  if (!key) {
    return { ok: false, message: "DART_API_KEY 가 서버에 없습니다." };
  }

  const MEANING: Record<string, string> = {
    "000": "정상",
    "010": "등록되지 않은 키",
    "011": "사용할 수 없는 키",
    "012": "접근할 수 없는 IP",
    "013": "조회된 자료 없음 (키 자체는 정상)",
    "020": "요청 제한 초과",
    "100": "요청 값 오류",
    "800": "DART 점검 중",
  };

  try {
    const url = new URL("https://opendart.fss.or.kr/api/list.json");
    url.searchParams.set("crtfc_key", key);
    url.searchParams.set("bgn_de", "20260901");
    url.searchParams.set("end_de", "20260901");
    url.searchParams.set("page_count", "1");

    const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    const body = (await response.json().catch(() => null)) as {
      status?: string;
    } | null;

    const status = String(body?.status ?? "");
    const good = status === "000" || status === "013";

    return {
      ok: good,
      message: `DART 응답 ${status} — ${MEANING[status] ?? "알 수 없는 코드"}`,
    };
  } catch {
    return { ok: false, message: "DART 서버에 연결하지 못했습니다." };
  }
}
