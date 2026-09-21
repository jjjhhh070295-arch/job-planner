import Link from "next/link";

import { toggleTask } from "./roadmap/actions";
import { MiniCalendar } from "@/components/mini-calendar";
import { PageShell } from "@/components/page-shell";
import { TaskCheckbox } from "@/components/roadmap-controls";
import {
  Card,
  CardHeader,
  EmptyState,
  StatCard,
  Tag,
} from "@/components/ui/primitives";
import { isClosed } from "@/lib/application-status";
import { currentMonth, itemTone, type CalendarItem } from "@/lib/calendar";
import {
  daysUntil,
  daysUntilTimestamp,
  formatDeadline,
  mondayOf,
  toDateInput,
  toTimeInput,
  todayInSeoul,
} from "@/lib/date";
import { getCurrentProfile } from "@/lib/auth/current-user";
import type { Task } from "@/lib/queries";
import { createOwnClient } from "@/lib/supabase/server";

type AppRow = {
  id: string;
  company: string;
  role: string | null;
  status: string;
  deadline: string | null;
};

type SpecRow = {
  id: string;
  name: string;
  score_or_grade: string | null;
  expiry_date: string | null;
};

type EventRow = {
  id: string;
  title: string;
  kind: string;
  start_at: string;
  all_day: boolean;
};

/** 마감 임박 목록에 올릴 범위 */
const DEADLINE_WINDOW_DAYS = 30;
const URGENT_DAYS = 3;
const EXPIRY_WINDOW_DAYS = 90;

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function HomePage() {
  const profile = await getCurrentProfile();
  const { supabase, userId } = await createOwnClient();

  const today = todayInSeoul();
  const weekStart = mondayOf(today);
  const weekEnd = addDays(weekStart, 6);
  const month = currentMonth();

  const [appResult, taskResult, specResult, eventResult] = await Promise.all([
    supabase
      .from("applications")
      .select("id, company, role, status, deadline")
      .eq("user_id", userId),
    supabase.from("tasks").select("*"),
    supabase
      .from("user_specs")
      .select("id, name, score_or_grade, expiry_date")
      .not("expiry_date", "is", null)
      .order("expiry_date"),
    supabase
      .from("events")
      .select("id, title, kind, start_at, all_day")
      .order("start_at"),
  ]);

  const applications = (appResult.data ?? []) as AppRow[];
  const tasks = (taskResult.data ?? []) as Task[];
  const specs = (specResult.data ?? []) as SpecRow[];
  const events = (eventResult.data ?? []) as EventRow[];

  /* ---------------- 요약 숫자 4개 ---------------- */

  const inProgress = applications.filter((a) => !isClosed(a.status));

  const dueThisWeek = inProgress.filter((a) => {
    if (!a.deadline) return false;
    const d = toDateInput(a.deadline);
    return d >= weekStart && d <= weekEnd;
  });

  // 서류 합격률: 제출한 것 중 서류를 통과한 비율.
  // 분모는 "작성 중"을 뺀 전부(탈락 포함), 분자는 서류 합격 이후 단계.
  const submitted = applications.filter((a) => a.status !== "작성 중");
  const passedDocs = applications.filter((a) =>
    ["서류 합격", "면접", "최종 합격"].includes(a.status),
  );
  const passRate =
    submitted.length === 0
      ? null
      : Math.round((passedDocs.length / submitted.length) * 100);

  const weekTasks = tasks.filter((t) => t.week_of === weekStart);
  const weekDone = weekTasks.filter((t) => t.done);
  const doneRate =
    weekTasks.length === 0
      ? null
      : Math.round((weekDone.length / weekTasks.length) * 100);

  /* ---------------- 날짜별 항목 (오늘 일정 + 미니 달력) ---------------- */

  const byDate = new Map<string, CalendarItem[]>();
  const urgentDates = new Set<string>();
  const push = (date: string, item: CalendarItem, urgent = false) => {
    const list = byDate.get(date) ?? [];
    list.push(item);
    byDate.set(date, list);
    if (urgent) urgentDates.add(date);
  };

  for (const app of inProgress) {
    if (!app.deadline) continue;
    const date = toDateInput(app.deadline);
    const days = daysUntilTimestamp(app.deadline);
    push(
      date,
      {
        id: `app-${app.id}`,
        type: "마감",
        label: app.company,
        time: toTimeInput(app.deadline),
      },
      days >= 0 && days <= URGENT_DAYS,
    );
  }

  for (const task of tasks) {
    if (task.done || !task.due_date) continue;
    push(task.due_date, {
      id: `task-${task.id}`,
      type: "할 일",
      label: task.title,
    });
  }

  for (const event of events) {
    push(toDateInput(event.start_at), {
      id: `event-${event.id}`,
      type: (event.kind as CalendarItem["type"]) ?? "개인",
      label: event.title,
      time: event.all_day ? undefined : toTimeInput(event.start_at),
    });
  }

  const todayItems = byDate.get(today) ?? [];
  const todayTasks = tasks.filter((t) => t.is_today && !t.done);

  /* ---------------- 마감 임박 ---------------- */

  const upcoming = inProgress
    .filter((a) => a.deadline)
    .map((a) => ({ ...a, days: daysUntilTimestamp(a.deadline!) }))
    .filter((a) => a.days >= 0 && a.days <= DEADLINE_WINDOW_DAYS)
    .sort((a, b) => a.days - b.days)
    .slice(0, 6);

  const expiring = specs
    .map((s) => ({ ...s, days: daysUntil(s.expiry_date!) }))
    .filter((s) => s.days <= EXPIRY_WINDOW_DAYS)
    .sort((a, b) => a.days - b.days)
    .slice(0, 3);

  return (
    <PageShell
      title={`${profile?.displayName ?? ""} 님, 오늘도 화이팅`}
      description={`오늘은 ${today} 입니다.`}
    >
      {/* ---------------- 요약 카드 4개 ---------------- */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <StatCard
          label="진행 중 지원"
          value={inProgress.length}
          unit="곳"
          hint={`전체 ${applications.length}곳`}
          href="/applications"
        />
        <StatCard
          label="이번 주 마감"
          value={dueThisWeek.length}
          unit="건"
          tone={dueThisWeek.length > 0 ? "danger" : "brand"}
          hint={`${weekStart.slice(5)} ~ ${weekEnd.slice(5)}`}
          href="/applications"
        />
        <StatCard
          label="서류 합격률"
          value={passRate === null ? "-" : passRate}
          unit={passRate === null ? undefined : "%"}
          tone="success"
          hint={
            submitted.length === 0
              ? "제출한 지원 없음"
              : `${passedDocs.length}/${submitted.length}곳`
          }
          href="/applications"
        />
        <StatCard
          label="이번 주 할 일"
          value={doneRate === null ? "-" : doneRate}
          unit={doneRate === null ? undefined : "%"}
          hint={
            weekTasks.length === 0
              ? "이번 주 할 일 없음"
              : `${weekDone.length}/${weekTasks.length}개 완료`
          }
          href="/roadmap"
        />
      </div>

      {/* ---------------- 오늘의 일정 + 미니 달력 ---------------- */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader
            title="오늘의 일정"
            count={todayItems.length}
            moreHref="/calendar"
          />

          {todayItems.length === 0 ? (
            <EmptyState
              text="오늘은 예정된 마감이나 일정이 없습니다."
              href="/calendar"
              cta="일정 추가하러 가기"
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {todayItems.map((item) => (
                <li key={item.id} className="flex items-center gap-2">
                  <span
                    className={
                      "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium " +
                      itemTone(item.type)
                    }
                  >
                    {item.type}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {item.label}
                  </span>
                  {item.time ? (
                    <span className="shrink-0 text-xs text-ink-400">
                      {item.time}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {/* 오늘 할 일은 여기서 바로 체크할 수 있게 둔다 */}
          <div className="mt-4 border-t border-line pt-3">
            <p className="mb-2 text-xs font-medium text-ink-500">
              오늘 할 일 {todayTasks.length > 0 ? `(${todayTasks.length})` : ""}
            </p>
            {todayTasks.length === 0 ? (
              <p className="text-xs text-ink-400">
                로드맵에서 별(★)을 눌러 오늘 할 일로 올리세요.
              </p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {todayTasks.map((task) => (
                  <li key={task.id} className="flex items-center gap-1">
                    <TaskCheckbox
                      action={toggleTask}
                      id={task.id}
                      done={task.done}
                      title={task.title}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {task.title}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <MiniCalendar
            month={month}
            today={today}
            markedDates={new Set(byDate.keys())}
            urgentDates={urgentDates}
          />
        </Card>
      </div>

      {/* ---------------- 마감 임박 ---------------- */}
      <Card>
        <CardHeader
          title="마감 임박"
          count={upcoming.length}
          moreHref="/applications"
        />

        {upcoming.length === 0 ? (
          <EmptyState
            text={`${DEADLINE_WINDOW_DAYS}일 안에 마감인 지원이 없습니다.`}
            href="/applications"
            cta="지원 추가하러 가기"
          />
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {upcoming.map((item) => {
              const urgent = item.days <= URGENT_DAYS;
              return (
                <li key={item.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {item.company}
                      {item.role ? (
                        <span className="font-normal text-ink-500">
                          {" "}
                          · {item.role}
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-ink-400">
                      {formatDeadline(item.deadline!)} · {item.status}
                    </p>
                  </div>
                  <Tag tone={urgent ? "danger" : "brand"}>
                    {item.days === 0 ? "D-DAY" : `D-${item.days}`}
                  </Tag>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* ---------------- 어학 유효기간 (있을 때만) ---------------- */}
      {expiring.length > 0 ? (
        <Card>
          <CardHeader
            title="어학·자격 유효기간"
            count={expiring.length}
            moreHref="/profile"
          />
          <ul className="flex flex-col divide-y divide-line">
            {expiring.map((item) => {
              const expired = item.days < 0;
              return (
                <li key={item.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {item.name}
                      {item.score_or_grade ? (
                        <span className="font-normal text-ink-500">
                          {" "}
                          · {item.score_or_grade}
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-ink-400">
                      {item.expiry_date} 만료
                    </p>
                  </div>
                  <Tag tone={expired ? "muted" : "danger"}>
                    {expired ? "만료됨" : `D-${item.days}`}
                  </Tag>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      <p className="text-center text-xs text-ink-400">
        <Link href="/roadmap" className="hover:underline">
          목표 로드맵에서 이번 달 마일스톤 보기
        </Link>
      </p>
    </PageShell>
  );
}
