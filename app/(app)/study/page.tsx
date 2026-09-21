import { addManualSession, removeSession } from "./actions";
import { TimerCard } from "./timer-card";
import { DeleteRowButton } from "@/components/delete-row-button";
import { PageShell } from "@/components/page-shell";
import { RecordForm, type Field } from "@/components/record-form";
import {
  Card,
  CardHeader,
  EmptyState,
  StatCard,
  Tag,
} from "@/components/ui/primitives";
import { formatYearMonth, mondayOf, toDateInput, todayInSeoul } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";

type SessionRow = {
  id: string;
  subject: string;
  started_at: string;
  ended_at: string | null;
  source: string;
  milestone_id: string | null;
  memo: string | null;
};

/** 분을 "3시간 20분" 으로 */
function formatMinutes(minutes: number): string {
  const m = Math.round(minutes);
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest}분`;
  if (rest === 0) return `${h}시간`;
  return `${h}시간 ${rest}분`;
}

function minutesOf(row: SessionRow): number {
  if (!row.ended_at) return 0;
  return (
    (new Date(row.ended_at).getTime() - new Date(row.started_at).getTime()) /
    60_000
  );
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function StudyPage() {
  const supabase = await createClient();

  const [sessionResult, milestoneResult] = await Promise.all([
    supabase
      .from("study_sessions")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(300),
    supabase.from("milestones").select("id, title, month, auto_source"),
  ]);

  const sessions = (sessionResult.data ?? []) as SessionRow[];
  const running = sessions.find((s) => s.ended_at === null) ?? null;
  const done = sessions.filter((s) => s.ended_at !== null);

  const milestones = (milestoneResult.data ?? []).map((row) => {
    const r = row as {
      id: string;
      title: string;
      month: string | null;
      auto_source: string;
    };
    return {
      value: r.id,
      label: r.month
        ? `${formatYearMonth(`${r.month}-01`)} ${r.title}`
        : r.title,
    };
  });
  const milestoneLabel = new Map(milestones.map((m) => [m.value, m.label]));

  const today = todayInSeoul();
  const weekStart = mondayOf(today);
  const weekEnd = addDays(weekStart, 6);

  /* ---------------- 통계 ---------------- */

  const todayMinutes = done
    .filter((s) => toDateInput(s.started_at) === today)
    .reduce((sum, s) => sum + minutesOf(s), 0);

  const weekMinutes = done
    .filter((s) => {
      const d = toDateInput(s.started_at);
      return d >= weekStart && d <= weekEnd;
    })
    .reduce((sum, s) => sum + minutesOf(s), 0);

  const totalMinutes = done.reduce((sum, s) => sum + minutesOf(s), 0);

  // 과목별 합계 (많은 순)
  const bySubject = new Map<string, number>();
  for (const s of done) {
    bySubject.set(s.subject, (bySubject.get(s.subject) ?? 0) + minutesOf(s));
  }
  const subjectRows = [...bySubject.entries()].sort((a, b) => b[1] - a[1]);
  const maxSubject = subjectRows[0]?.[1] ?? 0;

  // 최근 8주 주별 합계
  const byWeek = new Map<string, number>();
  for (const s of done) {
    const week = mondayOf(toDateInput(s.started_at));
    byWeek.set(week, (byWeek.get(week) ?? 0) + minutesOf(s));
  }
  const weekRows = [...byWeek.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 8);
  const maxWeek = Math.max(...weekRows.map(([, m]) => m), 1);

  const manualFields: Field[] = [
    { name: "subject", label: "과목", required: true, placeholder: "인적성" },
    { name: "date", label: "날짜", type: "date", required: true },
    {
      name: "start_time",
      label: "시작 시각",
      placeholder: "14:00",
      hint: "비우면 00:00 으로 둡니다",
    },
    {
      name: "minutes",
      label: "공부한 시간 (분)",
      type: "number",
      required: true,
      placeholder: "90",
    },
    ...(milestones.length > 0
      ? [
          {
            name: "milestone_id",
            label: "연결할 마일스톤",
            type: "select" as const,
            wide: true,
            choices: [
              { value: "", label: "연결 안 함" },
              ...milestones.map((m) => ({ value: m.value, label: m.label })),
            ],
          },
        ]
      : []),
    { name: "memo", label: "메모", type: "textarea" },
  ];

  return (
    <PageShell
      title="공부 기록"
      description="타이머로 재거나 나중에 직접 넣을 수 있습니다."
    >
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <StatCard label="오늘" value={formatMinutes(todayMinutes)} />
        <StatCard label="이번 주" value={formatMinutes(weekMinutes)} />
        <StatCard
          label="전체"
          value={formatMinutes(totalMinutes)}
          hint={`${done.length}회`}
        />
        <StatCard
          label="과목 수"
          value={subjectRows.length}
          unit="개"
          tone="muted"
        />
      </div>

      <TimerCard
        running={
          running
            ? {
                id: running.id,
                subject: running.subject,
                startedAt: running.started_at,
              }
            : null
        }
        milestones={milestones}
        subjects={[...bySubject.keys()].slice(0, 20)}
      />

      {/* ---------------- 과목별 ---------------- */}
      <Card>
        <CardHeader title="과목별" count={subjectRows.length} />
        {subjectRows.length === 0 ? (
          <EmptyState text="아직 기록이 없습니다. 위에서 타이머를 시작해 보세요." />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {subjectRows.map(([subject, minutes]) => (
              <li key={subject}>
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">{subject}</span>
                  <span className="shrink-0 text-ink-500">
                    {formatMinutes(minutes)}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted-100">
                  <div
                    className="h-full bg-brand-600"
                    style={{
                      width: `${maxSubject > 0 ? (minutes / maxSubject) * 100 : 0}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ---------------- 주별 ---------------- */}
      {weekRows.length > 0 ? (
        <Card>
          <CardHeader title="주별 (최근 8주)" />
          <ul className="flex flex-col gap-2.5">
            {weekRows.map(([week, minutes]) => (
              <li key={week}>
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span className="text-ink-500">
                    {week.slice(5).replace("-", "/")} 주
                    {week === weekStart ? " · 이번 주" : ""}
                  </span>
                  <span className="shrink-0 text-ink-500">
                    {formatMinutes(minutes)}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted-100">
                  <div
                    className={
                      "h-full " +
                      (week === weekStart ? "bg-brand-600" : "bg-brand-200")
                    }
                    style={{ width: `${(minutes / maxWeek) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* ---------------- 최근 기록 ---------------- */}
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-bold">
          최근 기록{" "}
          <span className="text-sm font-normal text-ink-400">{done.length}</span>
        </h2>

        {done.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-surface px-4 py-8 text-center text-sm text-ink-500">
            아직 기록이 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {done.slice(0, 30).map((row) => (
              <li
                key={row.id}
                className="flex items-start justify-between gap-2 rounded-xl border border-line bg-surface p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="min-w-0 truncate font-medium">
                      {row.subject}
                    </p>
                    <Tag tone="brand">{formatMinutes(minutesOf(row))}</Tag>
                    {row.source === "timer" ? <Tag>타이머</Tag> : null}
                    {row.source === "capture" ? <Tag>캡처</Tag> : null}
                  </div>
                  <p className="mt-0.5 text-sm text-ink-500">
                    {toDateInput(row.started_at)}
                    {row.milestone_id
                      ? ` · ${milestoneLabel.get(row.milestone_id) ?? "삭제된 마일스톤"}`
                      : ""}
                  </p>
                  {row.memo ? (
                    <p className="mt-1 wrap-anywhere whitespace-pre-wrap text-sm text-ink-500">
                      {row.memo}
                    </p>
                  ) : null}
                </div>
                <DeleteRowButton
                  action={removeSession}
                  id={row.id}
                  label={`${row.subject} 기록`}
                />
              </li>
            ))}
          </ul>
        )}

        <RecordForm
          action={addManualSession}
          fields={manualFields}
          openLabel="직접 입력하기"
          submitLabel="기록하기"
        />
      </section>
    </PageShell>
  );
}
