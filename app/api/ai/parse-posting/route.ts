import { NextResponse } from "next/server";

import { AiError, aiDailyLimit, callAI, consumeAiQuota } from "@/lib/ai";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { todayInSeoul } from "@/lib/date";
import {
  MAX_POSTING_LENGTH,
  POSTING_SCHEMA,
  buildPostingPrompt,
  verifyQuotes,
  type ParsedPosting,
} from "@/lib/posting-parser";

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "요청 형식이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const text = String(body.text ?? "").trim();
  if (text.length < 30) {
    return NextResponse.json(
      { message: "공고 내용을 조금 더 붙여넣어 주세요." },
      { status: 400 },
    );
  }
  if (text.length > MAX_POSTING_LENGTH) {
    return NextResponse.json(
      {
        message: `공고가 너무 깁니다. ${MAX_POSTING_LENGTH.toLocaleString()}자 이내로 줄여 주세요.`,
      },
      { status: 400 },
    );
  }

  try {
    const allowed = await consumeAiQuota(profile.userId);
    if (!allowed) {
      return NextResponse.json(
        {
          message: `오늘 AI 사용 횟수(${aiDailyLimit()}회)를 모두 썼습니다. 내일 다시 시도해 주세요.`,
        },
        { status: 429 },
      );
    }

    const parsed = await callAI<ParsedPosting>({
      prompt: buildPostingPrompt(todayInSeoul(), text),
      schema: POSTING_SCHEMA,
    });

    // 모델이 댄 근거가 진짜 공고에 있는 문장인지 대조한다.
    const checks = verifyQuotes(parsed, text);

    return NextResponse.json({ ok: true, parsed, checks });
  } catch (error) {
    if (error instanceof AiError) {
      return NextResponse.json({ message: error.message }, { status: 502 });
    }
    console.error("[parse-posting] 처리 실패", error);
    return NextResponse.json(
      { message: "공고를 읽는 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
