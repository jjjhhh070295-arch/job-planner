import {
  addGoal,
  addMilestone,
  addTask,
  bumpMilestone,
  removeGoal,
  removeMilestone,
  removeTask,
  toggleTask,
  toggleTaskToday,
  updateGoal,
  updateMilestone,
  updateTask,
} from "./actions";
import { DeleteRowButton } from "@/components/delete-row-button";
import { EditableRow } from "@/components/editable-row";
import { PageShell } from "@/components/page-shell";
import { RecordForm, type Field } from "@/components/record-form";
import {
  MilestoneBump,
  TaskCheckbox,
  TodayToggle,
} from "@/components/roadmap-controls";
import { formatYearMonth, mondayOf, todayInSeoul } from "@/lib/date";
import { loadProgressCounts, type Goal, type MilestoneRow, type Task } from "@/lib/queries";
import { AUTO_SOURCES, currentValue, percentOf, sourceLabel } from "@/lib/roadmap";
import { createClient } from "@/lib/supabase/server";

function ProgressBar({ percent }: { percent: number }) {
  const done = percent >= 100;
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-muted-100"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={"h-full " + (done ? "bg-success-500" : "bg-brand-600")}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function TaskRow({
  task,
  milestoneTitle,
  fields,
}: {
  task: Task;
  milestoneTitle?: string;
  fields: Field[];
}) {
  const overdue =
    !task.done && task.due_date !== null && task.due_date < todayInSeoul();

  return (
    <li>
      <EditableRow
        action={updateTask}
        fields={fields}
        defaults={{
          title: task.title,
          milestone_id: task.milestone_id,
          due_date: task.due_date,
          when: task.is_today ? "오늘" : "나중에",
        }}
        id={task.id}
        title={task.title}
        className="rounded-lg border border-line px-2 py-1.5"
        deleteSlot={
          <>
            <TodayToggle
              action={toggleTaskToday}
              id={task.id}
              isToday={task.is_today}
            />
            <DeleteRowButton
              action={removeTask}
              id={task.id}
              label={task.title}
            />
          </>
        }
      >
      <div className="flex items-center gap-1">
      <TaskCheckbox
        action={toggleTask}
        id={task.id}
        done={task.done}
        title={task.title}
      />
      <div className="min-w-0 flex-1">
        <p
          className={
            "truncate text-sm " +
            (task.done ? "text-ink-400 line-through" : "text-ink-900")
          }
        >
          {task.title}
        </p>
        {task.due_date || milestoneTitle ? (
          <p className="truncate text-xs text-ink-400">
            {[
              task.due_date
                ? `${task.due_date}${overdue ? " (지남)" : ""}`
                : null,
              milestoneTitle,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
      </div>
      {overdue ? (
        <span className="shrink-0 text-xs font-medium text-danger-600">지남</span>
      ) : null}
      </div>
      </EditableRow>
    </li>
  );
}

export default async function RoadmapPage() {
  const supabase = await createClient();

  const [goalResult, milestoneResult, taskResult, counts] = await Promise.all([
    supabase.from("goals").select("*").order("due_date", { nullsFirst: false }),
    supabase.from("milestones").select("*").order("month", { nullsFirst: false }),
    supabase
      .from("tasks")
      .select("*")
      .order("done")
      .order("due_date", { nullsFirst: false }),
    loadProgressCounts(supabase),
  ]);

  const goals = (goalResult.data ?? []) as Goal[];
  const milestones = (milestoneResult.data ?? []) as MilestoneRow[];
  const tasks = (taskResult.data ?? []) as Task[];

  const milestoneTitleById = new Map(milestones.map((m) => [m.id, m.title]));
  const thisMonday = mondayOf(todayInSeoul());

  const todayTasks = tasks.filter((task) => task.is_today && !task.done);
  const weekTasks = tasks.filter(
    (task) => !task.done && !task.is_today && task.week_of === thisMonday,
  );
  const laterTasks = tasks.filter(
    (task) =>
      !task.done &&
      !task.is_today &&
      (task.week_of === null || task.week_of !== thisMonday),
  );
  const doneTasks = tasks.filter((task) => task.done).slice(0, 20);

  const goalChoices = [
    { value: "", label: "목표 없음" },
    ...goals.map((goal) => ({ value: goal.id, label: goal.title })),
  ];
  const milestoneChoices = [
    { value: "", label: "마일스톤 없음" },
    ...milestones.map((m) => ({
      value: m.id,
      label: m.month ? `${formatYearMonth(`${m.month}-01`)} ${m.title}` : m.title,
    })),
  ];

  const goalFields: Field[] = [
    {
      name: "title",
      label: "목표",
      required: true,
      placeholder: "2026 상반기 금융권 취업",
      wide: true,
    },
    { name: "due_date", label: "목표 시점", type: "date" },
  ];

  const milestoneFields: Field[] = [
    {
      name: "title",
      label: "마일스톤",
      required: true,
      placeholder: "서류 15곳 제출",
    },
    { name: "goal_id", label: "목표", type: "select", choices: goalChoices },
    { name: "month", label: "달", placeholder: "2026-03", hint: "YYYY-MM" },
    { name: "target_value", label: "목표 수치", type: "number", placeholder: "15" },
    {
      name: "auto_source",
      label: "진행률 기준",
      type: "select",
      choices: AUTO_SOURCES.map((item) => ({
        value: item.value,
        label: item.label,
      })),
      hint: "직접 세기를 고르면 +/- 버튼으로 올립니다",
      wide: true,
    },
  ];

  const taskFields: Field[] = [
    {
      name: "title",
      label: "할 일",
      required: true,
      placeholder: "○○전자 자소서 1번 문항 초안",
      wide: true,
    },
    {
      name: "milestone_id",
      label: "마일스톤",
      type: "select",
      choices: milestoneChoices,
    },
    { name: "due_date", label: "마감", type: "date" },
    {
      name: "when",
      label: "언제",
      type: "select",
      options: ["나중에", "오늘"],
    },
  ];

  return (
    <PageShell
      title="목표 로드맵"
      description="최종 목표를 달 단위 마일스톤으로 쪼개고, 그 아래에 할 일을 답니다."
    >
      {/* ---------------- 목표 · 마일스톤 ---------------- */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold">
          목표{" "}
          <span className="text-sm font-normal text-ink-400">
            {goals.length}
          </span>
        </h2>

        {goals.length === 0 && milestones.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-surface px-4 py-8 text-center text-sm text-ink-500">
            아직 목표가 없습니다. 최종 목표를 하나 정하고, 그 아래에 달별
            마일스톤을 붙여 보세요.
          </p>
        ) : null}

        <ul className="flex flex-col gap-3">
          {goals.map((goal) => {
            const own = milestones.filter((m) => m.goal_id === goal.id);
            return (
              <li key={goal.id}>
                <EditableRow
                  action={updateGoal}
                  fields={goalFields}
                  defaults={{ title: goal.title, due_date: goal.due_date }}
                  id={goal.id}
                  title={goal.title}
                  deleteSlot={
                    <DeleteRowButton
                      action={removeGoal}
                      id={goal.id}
                      label={goal.title}
                    />
                  }
                >
                  <div className="min-w-0">
                    <p className="font-medium">{goal.title}</p>
                    {goal.due_date ? (
                      <p className="text-xs text-ink-500">
                        목표 시점 {goal.due_date}
                      </p>
                    ) : null}
                  </div>

                {own.length === 0 ? (
                  <p className="mt-3 text-sm text-ink-400">
                    이 목표에 달린 마일스톤이 없습니다.
                  </p>
                ) : (
                  <ul className="mt-3 flex flex-col gap-3">
                    {own.map((milestone) => {
                      const current = currentValue(milestone, counts);
                      const percent = percentOf(
                        current,
                        milestone.target_value,
                      );
                      return (
                        <li key={milestone.id}>
                          <EditableRow
                            action={updateMilestone}
                            fields={milestoneFields}
                            defaults={{
                              title: milestone.title,
                              goal_id: milestone.goal_id,
                              month: milestone.month,
                              target_value: String(milestone.target_value),
                              auto_source: milestone.auto_source,
                            }}
                            id={milestone.id}
                            title={milestone.title}
                            className=""
                            deleteSlot={
                              <>
                                {milestone.auto_source === "manual" ? (
                                  <MilestoneBump
                                    action={bumpMilestone}
                                    id={milestone.id}
                                  />
                                ) : null}
                                <DeleteRowButton
                                  action={removeMilestone}
                                  id={milestone.id}
                                  label={milestone.title}
                                />
                              </>
                            }
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="min-w-0 truncate text-sm font-medium">
                                {milestone.month ? (
                                  <span className="text-ink-400">
                                    {milestone.month}{" "}
                                  </span>
                                ) : null}
                                {milestone.title}
                              </p>
                              <span className="shrink-0 text-xs text-ink-500">
                                {current} / {milestone.target_value}
                              </span>
                            </div>
                            <div className="mt-1.5">
                              <ProgressBar percent={percent} />
                            </div>
                            <p className="mt-1 text-xs text-ink-400">
                              {sourceLabel(milestone.auto_source)} · {percent}%
                            </p>
                          </EditableRow>
                        </li>
                      );
                    })}
                  </ul>
                )}
                </EditableRow>
              </li>
            );
          })}
        </ul>

        {/* 목표에 안 묶인 마일스톤 */}
        {milestones.some((m) => !m.goal_id) ? (
          <div className="rounded-xl border border-line bg-surface p-4">
            <p className="text-sm font-medium text-ink-500">
              목표에 묶이지 않은 마일스톤
            </p>
            <ul className="mt-3 flex flex-col gap-3">
              {milestones
                .filter((m) => !m.goal_id)
                .map((milestone) => {
                  const current = currentValue(milestone, counts);
                  const percent = percentOf(current, milestone.target_value);
                  return (
                    <li key={milestone.id}>
                      <EditableRow
                        action={updateMilestone}
                        fields={milestoneFields}
                        defaults={{
                          title: milestone.title,
                          goal_id: milestone.goal_id,
                          month: milestone.month,
                          target_value: String(milestone.target_value),
                          auto_source: milestone.auto_source,
                        }}
                        id={milestone.id}
                        title={milestone.title}
                        className=""
                        deleteSlot={
                          <>
                            {milestone.auto_source === "manual" ? (
                              <MilestoneBump
                                action={bumpMilestone}
                                id={milestone.id}
                              />
                            ) : null}
                            <DeleteRowButton
                              action={removeMilestone}
                              id={milestone.id}
                              label={milestone.title}
                            />
                          </>
                        }
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="min-w-0 truncate text-sm font-medium">
                            {milestone.title}
                          </p>
                          <span className="shrink-0 text-xs text-ink-500">
                            {current} / {milestone.target_value}
                          </span>
                        </div>
                        <div className="mt-1.5">
                          <ProgressBar percent={percent} />
                        </div>
                      </EditableRow>
                    </li>
                  );
                })}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <RecordForm
            action={addGoal}
            fields={goalFields}
            openLabel="목표 추가"
          />
          <RecordForm
            action={addMilestone}
            fields={milestoneFields}
            openLabel="마일스톤 추가"
          />
        </div>
      </section>

      {/* ---------------- 할 일 ---------------- */}
      <section className="flex flex-col gap-4">
        <h2 className="text-base font-bold">할 일</h2>

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-ink-500">
            오늘 {todayTasks.length > 0 ? `(${todayTasks.length})` : ""}
          </h3>
          {todayTasks.length === 0 ? (
            <p className="text-sm text-ink-400">
              별(★)을 눌러 오늘 할 일로 올리세요.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {todayTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  fields={taskFields}
                  milestoneTitle={
                    task.milestone_id
                      ? milestoneTitleById.get(task.milestone_id)
                      : undefined
                  }
                />
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-ink-500">
            이번 주 {weekTasks.length > 0 ? `(${weekTasks.length})` : ""}
          </h3>
          {weekTasks.length === 0 ? (
            <p className="text-sm text-ink-400">이번 주에 남은 일이 없습니다.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {weekTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  fields={taskFields}
                  milestoneTitle={
                    task.milestone_id
                      ? milestoneTitleById.get(task.milestone_id)
                      : undefined
                  }
                />
              ))}
            </ul>
          )}
        </div>

        {laterTasks.length > 0 ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-ink-500">
              그 밖에 ({laterTasks.length})
            </h3>
            <ul className="flex flex-col gap-1.5">
              {laterTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  fields={taskFields}
                  milestoneTitle={
                    task.milestone_id
                      ? milestoneTitleById.get(task.milestone_id)
                      : undefined
                  }
                />
              ))}
            </ul>
          </div>
        ) : null}

        {doneTasks.length > 0 ? (
          <details>
            <summary className="cursor-pointer text-sm font-medium text-brand-600">
              끝낸 일 {doneTasks.length}개 보기
            </summary>
            <ul className="mt-2 flex flex-col gap-1.5">
              {doneTasks.map((task) => (
                <TaskRow key={task.id} task={task} fields={taskFields} />
              ))}
            </ul>
          </details>
        ) : null}

        <RecordForm
          action={addTask}
          fields={taskFields}
          openLabel="할 일 추가"
        />
      </section>
    </PageShell>
  );
}
