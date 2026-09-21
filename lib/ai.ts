import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/* ============================================================
   AI 호출은 전부 이 파일을 거친다 (CLAUDE.md 3장 6번).
   공급자를 바꾸더라도 여기만 고치면 된다.
   ============================================================ */

/**
 * 기본 모델.
 * 2026-09-21 기준으로 pro 계열(gemini-2.5-pro, gemini-3.1-pro)은 무료 티어에서
 * 아예 쓸 수 없다(quota 0). 쓸 수 있는 모델로 한국어 공고 파싱을 비교한 결과
 * gemini-2.5-flash 가 정확도 최고점이면서 gemini-3.5-flash 보다 훨씬 빨랐다.
 * 다른 모델로 바꾸고 싶으면 .env 의 GEMINI_MODEL 만 고치면 된다.
 */
const DEFAULT_MODEL = "gemini-2.5-flash";
const TIMEOUT_MS = 90_000;

/** 사용자에게 그대로 보여 줘도 되는 오류 */
export class AiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiError";
  }
}

export function aiDailyLimit(): number {
  const raw = Number.parseInt(process.env.AI_DAILY_LIMIT_PER_USER ?? "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 30;
}

/** 하루 한도 안에서 1회를 쓴다. 한도를 넘으면 false. */
export async function consumeAiQuota(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("consume_ai_quota", {
    p_user_id: userId,
    p_limit: aiDailyLimit(),
  });

  if (error) {
    console.error("[ai] 한도 확인 실패", error.message);
    // 한도를 못 세는 상황에서 무제한으로 열어 두면 안 된다.
    throw new AiError("AI 사용량을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }

  return data === true;
}

export async function aiUsedToday(userId: string): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("ai_quota_used_today", {
    p_user_id: userId,
  });
  if (error) {
    console.error("[ai] 사용량 조회 실패", error.message);
    return 0;
  }
  return typeof data === "number" ? data : 0;
}

/**
 * 구조화된 JSON 을 받아 오는 호출.
 *
 * 정확도를 위해 세 가지를 고정한다:
 *  - responseSchema 로 모양을 강제한다 (JSON 파싱 실패와 빠진 항목을 원천 차단)
 *  - temperature 0 으로 같은 입력에 같은 답을 내게 한다
 *  - 프롬프트에서 "모르면 null" 과 "근거 원문 인용"을 요구한다 (호출부 책임)
 */
export async function callAI<T>({
  prompt,
  schema,
  maxOutputTokens = 8192,
}: {
  prompt: string;
  schema: Record<string, unknown>;
  maxOutputTokens?: number;
}): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new AiError("AI 키가 설정되지 않았습니다. 운영자에게 알려 주세요.");
  }

  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          // 키는 헤더로만 보낸다. URL 에 넣으면 로그에 남는다.
          "x-goog-api-key": key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
            responseSchema: schema,
            maxOutputTokens,
          },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    console.error("[ai] 호출 실패", error);
    throw new AiError(
      timedOut
        ? "AI 응답이 너무 오래 걸립니다. 공고를 조금 줄여서 다시 시도해 주세요."
        : "AI 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message = (body as { error?: { message?: string } })?.error?.message;
    console.error("[ai] 오류 응답", response.status, message);
    if (response.status === 429) {
      throw new AiError(
        "AI 사용량이 몰려 있습니다. 잠시 후 다시 시도해 주세요.",
      );
    }
    throw new AiError("AI가 공고를 읽지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }

  const parts =
    (
      body as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      }
    )?.candidates?.[0]?.content?.parts ?? [];
  const raw = parts.map((p) => p.text ?? "").join("");

  if (!raw.trim()) {
    throw new AiError("AI가 빈 응답을 보냈습니다. 다시 시도해 주세요.");
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    // responseSchema 를 쓰면 거의 생기지 않지만, 생기면 화면에서 직접 입력하게 한다.
    console.error("[ai] JSON 파싱 실패", raw.slice(0, 300));
    throw new AiError(
      "AI 응답을 이해하지 못했습니다. 직접 입력해 주세요.",
    );
  }
}
