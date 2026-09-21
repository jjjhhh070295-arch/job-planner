import { NextResponse } from "next/server";

import { AiError, aiDailyLimit, callAI, consumeAiQuota } from "@/lib/ai";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { todayInSeoul } from "@/lib/date";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "study-captures";

const SCHEMA = {
  type: "object",
  properties: {
    subject: { type: "string", nullable: true },
    date: { type: "string", nullable: true },
    minutes: { type: "integer", nullable: true },
    raw_text: { type: "string", nullable: true },
    confident: { type: "boolean" },
  },
  required: ["subject", "date", "minutes", "raw_text", "confident"],
};

type CaptureResult = {
  subject: string | null;
  date: string | null;
  minutes: number | null;
  raw_text: string | null;
  confident: boolean;
};

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

  const path = String(body.path ?? "").trim();
  // 남의 폴더 파일을 읽어 달라고 요청할 수 없게 경로를 직접 확인한다.
  // Storage 정책으로도 막히지만 서버 키로 내려받으므로 여기서 한 번 더 본다.
  if (!path || !path.startsWith(`${profile.userId}/`)) {
    return NextResponse.json(
      { message: "잘못된 파일 경로입니다." },
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

    const admin = createAdminClient();
    const { data: file, error: downloadError } = await admin.storage
      .from(BUCKET)
      .download(path);

    if (downloadError || !file) {
      console.error("[parse-capture] 내려받기 실패", downloadError?.message);
      return NextResponse.json(
        { message: "올린 이미지를 읽지 못했습니다." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    const mimeType = file.type || "image/jpeg";

    const parsed = await callAI<CaptureResult>({
      prompt: [
        "너는 공부 시간 기록 앱(열품타, 스터디플래너 등)의 화면 캡처에서",
        "공부한 시간을 읽어내는 도구다.",
        "",
        `오늘 날짜는 ${todayInSeoul()} (Asia/Seoul) 이다.`,
        "",
        "규칙:",
        "- 화면에 보이지 않는 것은 지어내지 마라. 모르면 null 을 넣어라.",
        "- minutes 는 공부한 시간을 분으로 환산한 숫자다.",
        "  '3시간 20분' 은 200, '01:25:30' 은 85 다. 초는 버린다.",
        "- date 는 캡처에 보이는 날짜를 YYYY-MM-DD 로 쓴다.",
        "  날짜가 안 보이면 null 로 두어라. 오늘 날짜로 넘겨짚지 마라.",
        "- subject 는 과목·카테고리 이름이다. 여러 개면 가장 시간이 긴 것 하나.",
        "- raw_text 에는 시간을 읽어낸 근거가 된 화면 속 글자를 그대로 적어라.",
        "- confident 는 숫자를 확실히 읽었으면 true, 흐릿하거나 애매하면 false 다.",
      ].join("\n"),
      schema: SCHEMA,
      image: { base64, mimeType },
      maxOutputTokens: 1024,
    });

    return NextResponse.json({ ok: true, parsed });
  } catch (error) {
    if (error instanceof AiError) {
      return NextResponse.json({ message: error.message }, { status: 502 });
    }
    console.error("[parse-capture] 처리 실패", error);
    return NextResponse.json(
      { message: "캡처를 읽는 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
