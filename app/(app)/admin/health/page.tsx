import { notFound, redirect } from "next/navigation";

import { testDart, testGemini } from "./actions";
import { TestButton } from "./test-button";
import { PageShell } from "@/components/page-shell";
import { Card, CardHeader, Tag } from "@/components/ui/primitives";
import { aiDailyLimit } from "@/lib/ai";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { isAdminUsername } from "@/lib/supabase/admin";

/**
 * 배포된 서버가 환경변수를 제대로 읽고 있는지 확인하는 화면.
 * **값은 절대 표시하지 않는다.** 설정 여부와 실제 호출 성공 여부만 본다.
 */
export default async function AdminHealthPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!isAdminUsername(profile.username)) notFound();

  const isSet = (name: string) => Boolean(process.env[name]?.trim());

  const rows: {
    name: string;
    set: boolean;
    required: boolean;
    note: string;
  }[] = [
    {
      name: "NEXT_PUBLIC_SUPABASE_URL",
      set: isSet("NEXT_PUBLIC_SUPABASE_URL"),
      required: true,
      note: "없으면 앱 전체가 뜨지 않습니다",
    },
    {
      name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      set: isSet("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      required: true,
      note: "없으면 앱 전체가 뜨지 않습니다",
    },
    {
      name: "SUPABASE_SERVICE_ROLE_KEY",
      set: isSet("SUPABASE_SERVICE_ROLE_KEY"),
      required: true,
      note: "가입·관리자 기능에 필요합니다",
    },
    {
      name: "ADMIN_USERNAMES",
      set: isSet("ADMIN_USERNAMES"),
      required: true,
      note: "이 화면이 보이니 읽히고 있습니다",
    },
    {
      name: "GEMINI_API_KEY",
      set: isSet("GEMINI_API_KEY"),
      required: true,
      note: "공고 파싱·캡처 읽기에 필요합니다",
    },
    {
      name: "AI_DAILY_LIMIT_PER_USER",
      set: isSet("AI_DAILY_LIMIT_PER_USER"),
      required: false,
      note: `없으면 기본 30회. 지금 적용값 ${aiDailyLimit()}회`,
    },
    {
      name: "DART_API_KEY",
      set: isSet("DART_API_KEY"),
      required: false,
      note: "없으면 기업분석 탭이 안내 문구만 표시합니다",
    },
    {
      name: "VAPID_PUBLIC_KEY",
      set: isSet("VAPID_PUBLIC_KEY"),
      required: false,
      note: "없으면 알림 켜기 버튼이 오류를 냅니다",
    },
    {
      name: "VAPID_PRIVATE_KEY",
      set: isSet("VAPID_PRIVATE_KEY"),
      required: false,
      note: "없으면 알림이 한 통도 가지 않습니다",
    },
    {
      name: "VAPID_SUBJECT",
      set: isSet("VAPID_SUBJECT"),
      required: false,
      note: "없으면 기본 연락처로 동작합니다",
    },
    {
      name: "CRON_SECRET",
      set: isSet("CRON_SECRET"),
      required: false,
      note: "없으면 예약 발송이 거절됩니다",
    },
    {
      name: "GEMINI_MODEL",
      set: isSet("GEMINI_MODEL"),
      required: false,
      note: `없으면 기본값 사용. 지금 ${process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash"}`,
    },
    {
      name: "DATABASE_URL",
      set: isSet("DATABASE_URL"),
      required: false,
      note: "로컬 전용입니다. 배포 서버에는 없는 것이 맞습니다",
    },
  ];

  const missing = rows.filter((row) => row.required && !row.set);

  return (
    <PageShell
      title="서버 점검"
      description="배포된 서버가 환경변수를 읽고 있는지 확인합니다."
    >
      <p className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-500">
        이 화면은 <strong>값을 절대 보여 주지 않습니다.</strong> 설정 여부와
        실제 호출 성공 여부만 확인합니다. 여기서 보이는 결과는{" "}
        <strong>지금 이 페이지를 띄운 서버 기준</strong>입니다. 배포본에서 열면
        Vercel 설정이, 로컬에서 열면 <code>.env.local</code> 이 반영됩니다.
      </p>

      {missing.length > 0 ? (
        <p className="rounded-xl bg-danger-50 px-4 py-3 text-sm text-danger-700">
          꼭 필요한 값 {missing.length}개가 없습니다:{" "}
          {missing.map((row) => row.name).join(", ")}
        </p>
      ) : (
        <p className="rounded-xl bg-success-50 px-4 py-3 text-sm text-success-700">
          꼭 필요한 값이 모두 설정되어 있습니다.
        </p>
      )}

      <Card>
        <CardHeader title="환경변수" />
        <ul className="flex flex-col divide-y divide-line">
          {rows.map((row) => (
            <li
              key={row.name}
              className="flex items-start justify-between gap-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="wrap-anywhere font-mono text-sm">{row.name}</p>
                <p className="mt-0.5 text-xs text-ink-400">{row.note}</p>
              </div>
              <Tag
                tone={
                  row.set ? "success" : row.required ? "danger" : "muted"
                }
              >
                {row.set ? "설정됨" : "없음"}
              </Tag>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader title="실제로 불러 보기" />
        <p className="text-sm text-ink-500">
          키가 들어 있기만 한 게 아니라 정말 통하는지 확인합니다. 사용자 하루
          AI 한도는 깎지 않습니다.
        </p>
        <TestButton action={testGemini} label="Gemini 확인" />
        <TestButton action={testDart} label="DART 확인" />
      </Card>
    </PageShell>
  );
}
