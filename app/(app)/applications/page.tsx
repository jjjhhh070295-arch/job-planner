import { addApplication } from "./actions";
import { ApplicationsView, type Application } from "./applications-view";
import { PageShell } from "@/components/page-shell";
import { RecordForm, type Field } from "@/components/record-form";
import { STATUSES } from "@/lib/application-status";
import { daysUntilTimestamp, formatDeadline, toDateInput } from "@/lib/date";
import { createOwnClient } from "@/lib/supabase/server";

const FIELDS: Field[] = [
  { name: "company", label: "기업", required: true, placeholder: "○○전자" },
  { name: "role", label: "직무", placeholder: "경영지원" },
  { name: "season", label: "시즌", placeholder: "2026 상반기" },
  {
    name: "status",
    label: "전형 단계",
    type: "select",
    options: [...STATUSES],
  },
  { name: "deadline", label: "마감", type: "date", hint: "자소서 마감일" },
  { name: "posting_url", label: "공고 링크", placeholder: "https://..." },
  { name: "memo", label: "메모", type: "textarea" },
];

export default async function ApplicationsPage() {
  const { supabase, userId } = await createOwnClient();
  const { data } = await supabase
    .from("applications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  // 날짜 계산은 서버에서 서울 기준으로 끝내고 문자열로 넘긴다.
  // 브라우저 시간대에 따라 D-day 가 달라지면 안 된다.
  const items: Application[] = (data ?? []).map((row) => {
    const item = row as Record<string, unknown>;
    const deadline = (item.deadline as string | null) ?? null;
    return {
      id: item.id as string,
      company: item.company as string,
      role: (item.role as string | null) ?? null,
      season: (item.season as string | null) ?? null,
      status: item.status as string,
      deadline,
      posting_url: (item.posting_url as string | null) ?? null,
      memo: (item.memo as string | null) ?? null,
      created_at: item.created_at as string,
      deadlineDate: deadline ? toDateInput(deadline) : null,
      deadlineText: deadline ? formatDeadline(deadline) : null,
      daysLeft: deadline ? daysUntilTimestamp(deadline) : null,
    };
  });

  return (
    <PageShell title="지원 현황" description={`전체 ${items.length}곳`}>
      <ApplicationsView items={items} fields={FIELDS} />
      <RecordForm
        action={addApplication}
        fields={FIELDS}
        openLabel="지원 추가"
      />
    </PageShell>
  );
}
