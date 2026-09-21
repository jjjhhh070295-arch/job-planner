import Link from "next/link";

import { toggleTask, toggleTaskToday } from "./roadmap/actions";
import { DashboardCard, EmptyCard } from "@/components/dashboard-card";
import { PageShell } from "@/components/page-shell";
import { TaskCheckbox, TodayToggle } from "@/components/roadmap-controls";
import { isClosed } from "@/lib/application-status";
import {
  dDayLabel,
  daysUntil,
  daysUntilTimestamp,
  formatDeadline,
  mondayOf,
  todayInSeoul,
  urgencyOf,
} from "@/lib/date";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { loadProgressCounts, type Goal, type MilestoneRow, type Task } from "@/lib/queries";
import { currentValue, percentOf } from "@/lib/roadmap";
import { createClient } from "@/lib/supabase/server";

type DeadlineItem = {
  id: string;
  company: string;
  role: string | null;
  status: string;
  deadline: string | null;
};

type SpecItem = {
  id: string;
  name: string;
  score_or_grade: string | null;
  expiry_date: string | null;
};

/** 마감·유효기간이 며칠 안 남았을 때만 대시보드에 올린다. */
const DEADLINE_WINDOW_DAYS = 30;
const EXPIRY_WINDOW_DAYS = 90;

function MiniProgress({ percent }: { percent: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
      <div
        className={"h-full " + (percent >= 100 ? "bg-green-500" : "bg-blue-600")}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function TaskLine({ task }: { task: Task }) {
  const overdue =
    !task.done && task.due_date !== null && task.due_date < todayInSeoul();

  return (
    <li className="flex items-center gap-1">
      <TaskCheckbox
        action={toggleTask}
        id={task.id}
        done={task.done}
        title={task.title}
      />
      <span className="min-w-0 flex-1 truncate text-sm text-gray-800">
        {task.title}
      </span>
      {overdue ? (
        <span className="shrink-0 text-xs font-medium text-red-600">지남</span>
      ) : null}
      <TodayToggle
        action={toggleTaskToday}
        id={task.id}
        isToday={task.is_today}
      />
    </li>
  );
}

export default async function HomePage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const today = todayInSeoul();

  const [goalResult, milestoneResult, taskResult, appResult, specResult, counts] =
    await Promise.all([
      supabase.from("goals").select("*").order("due_date", { nullsFirst: false }),
      supabase
        .from("milestones")
        .select("*")
        .order("month", { nullsFirst: false }),
      supabase
        .from("tasks")
        .select("*")
        .eq("done", false)
        .order("due_date", { nullsFirst: false }),
      supabase
        .from("applications")
        .select("id, company, role, status, deadline")
        .not("deadline", "is", null)
        .order("deadline", { ascending: true }),
      supabase
        .from("user_specs")
        .select("id, name, score_or_grade, expiry_date")
        .not("expiry_date", "is", null)
        .order("expiry_date", { ascending: true }),
      loadProgressCounts(supabase),
    ]);

  const goals = (goalResult.data ?? []) as Goal[];
  const milestones = (milestoneResult.data ?? []) as MilestoneRow[];
  const openTasks = (taskResult.data ?? []) as Task[];

  const thisMonday = mondayOf(today);
  const todayTasks = openTasks.filter((task) => task.is_today);
  const weekTasks = openTasks.filter(
    (task) => !task.is_today && task.week_of === thisMonday,
  );

  // 끝난 전형과 이미 지난 마감은 뺀다. 남은 날이 적은 순.
  const upcoming = ((appResult.data ?? []) as DeadlineItem[])
    .filter((item) => item.deadline !== null && !isClosed(item.status))
    .map((item) => ({ ...item, days: daysUntilTimestamp(item.deadline!) }))
    .filter((item) => item.days >= 0 && item.days <= DEADLINE_WINDOW_DAYS)
    .slice(0, 5);

  // 이미 만료됐거나 곧 만료되는 것만.
  const expiring = ((specResult.data ?? []) as SpecItem[])
    .map((item) => ({ ...item, days: daysUntil(item.expiry_date!) }))
    .filter((item) => item.days <= EXPIRY_WINDOW_DAYS)
    .slice(0, 5);

  const hasRoadmap = goals.length > 0 || milestones.length > 0;

  return (
    <PageShell
      title={`${profile?.displayName ?? ""} 님, 오늘도 화이팅`}
      description={`오늘은 ${today} 입니다.`}
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ---------------- 목표 로드맵 ---------------- */}
        <DashboardCard
          title="목표 로드맵"
          moreHref="/roadmap"
          moreLabel={hasRoadmap ? "관리하기" : undefined}
        >
          {!hasRoadmap ? (
            <EmptyCard
              text="최종 목표를 정하고 달별 마일스톤으로 쪼개면 진행률이 여기에 보입니다."
              href="/roadmap"
              cta="목표 추가하러 가기"
            />
          ) : (
            <div className="flex flex-col gap-4">
              {goals.map((goal) => {
                const own = milestones.filter((m) => m.goal_id === goal.id);
                const dday = goal.due_date ? dDayLabel(goal.due_date) : null;
                return (
                  <div key={goal.id}>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="min-w-0 truncate font-medium">
                        {goal.title}
                      </p>
                      {dday ? (
                        <span className="shrink-0 text-xs text-gray-500">
                          {dday}
                        </span>
                      ) : null}
                    </div>

                    {own.length === 0 ? (
                      <p className="mt-1 text-xs text-gray-400">
                        달별 마일스톤이 아직 없습니다.
                      </p>
                    ) : (
                      <ul className="mt-2 flex flex-col gap-2">
                        {own.map((milestone) => {
                          const current = currentValue(milestone, counts);
                          const percent = percentOf(
                            current,
                            milestone.target_value,
                          );
                          return (
                            <li key={milestone.id}>
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <span className="min-w-0 truncate text-gray-700">
                                  {milestone.month ? (
                                    <span className="text-gray-400">
                                      {milestone.month}{" "}
                                    </span>
                                  ) : null}
                                  {milestone.title}
                                </span>
                                <span className="shrink-0 text-gray-500">
                                  {current} / {milestone.target_value}
                                </span>
                              </div>
                              <div className="mt-1">
                                <MiniProgress percent={percent} />
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}

              {milestones.some((m) => !m.goal_id) ? (
                <p className="text-xs text-gray-400">
                  목표에 묶이지 않은 마일스톤
                  {milestones.filter((m) => !m.goal_id).length}개는{" "}
                  <Link
                    href="/roadmap"
                    className="font-medium text-blue-600 hover:underline"
                  >
                    로드맵
                  </Link>
                  에서 볼 수 있습니다.
                </p>
              ) : null}
            </div>
          )}
        </DashboardCard>

        {/* ---------------- 이번 주 → 오늘 할 일 ---------------- */}
        <DashboardCard
          title="할 일"
          moreHref="/roadmap"
          moreLabel={openTasks.length > 0 ? "전체 보기" : undefined}
        >
          {openTasks.length === 0 ? (
            <EmptyCard
              text="남은 할 일이 없습니다. 이번 주에 할 일을 적어 두면 여기에 모입니다."
              href="/roadmap"
              cta="할 일 추가하러 가기"
            />
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <p className="mb-2 text-xs font-medium text-gray-500">
                  오늘 {todayTasks.length > 0 ? `(${todayTasks.length})` : ""}
                </p>
                {todayTasks.length === 0 ? (
                  <p className="text-xs text-gray-400">
                    별(★)을 눌러 오늘 할 일로 올리세요.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {todayTasks.map((task) => (
                      <TaskLine key={task.id} task={task} />
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-gray-500">
                  이번 주 {weekTasks.length > 0 ? `(${weekTasks.length})` : ""}
                </p>
                {weekTasks.length === 0 ? (
                  <p className="text-xs text-gray-400">
                    이번 주에 남은 일이 없습니다.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {weekTasks.map((task) => (
                      <TaskLine key={task.id} task={task} />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </DashboardCard>

        {/* ---------------- 마감 임박 ---------------- */}
        <DashboardCard
          title="마감 임박"
          count={upcoming.length}
          moreHref="/applications"
        >
          {upcoming.length === 0 ? (
            <EmptyCard
              text={`${DEADLINE_WINDOW_DAYS}일 안에 마감인 지원이 없습니다.`}
              href="/applications"
              cta="지원 추가하러 가기"
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {upcoming.map((item) => {
                const urgent = item.days <= 3;
                return (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {item.company}
                        {item.role ? (
                          <span className="font-normal text-gray-500">
                            {" "}
                            · {item.role}
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-gray-400">
                        {formatDeadline(item.deadline!)} · {item.status}
                      </p>
                    </div>
                    <span
                      className={
                        "shrink-0 rounded px-2 py-0.5 text-xs font-bold " +
                        (urgent
                          ? "bg-red-100 text-red-700"
                          : "bg-blue-100 text-blue-700")
                      }
                    >
                      {item.days === 0 ? "D-DAY" : `D-${item.days}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </DashboardCard>

        {/* ---------------- 어학 유효기간 ---------------- */}
        <DashboardCard
          title="어학·자격 유효기간"
          count={expiring.length}
          moreHref="/profile"
        >
          {expiring.length === 0 ? (
            <EmptyCard
              text="곧 만료되는 어학 점수나 자격증이 없습니다. 유효기간을 넣어 두면 미리 알려 드립니다."
              href="/profile"
              cta="자격·어학 추가하러 가기"
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {expiring.map((item) => {
                const urgency = urgencyOf(item.expiry_date!);
                const expired = urgency === "expired";
                return (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {item.name}
                        {item.score_or_grade ? (
                          <span className="font-normal text-gray-500">
                            {" "}
                            · {item.score_or_grade}
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-gray-400">
                        {item.expiry_date} 만료
                      </p>
                    </div>
                    <span
                      className={
                        "shrink-0 rounded px-2 py-0.5 text-xs font-bold " +
                        (expired
                          ? "bg-gray-100 text-gray-500"
                          : "bg-red-100 text-red-700")
                      }
                    >
                      {expired ? "만료됨" : dDayLabel(item.expiry_date!)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </DashboardCard>
      </div>
    </PageShell>
  );
}
