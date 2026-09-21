import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { addEvent, removeEvent, updateEvent } from "./actions";
import { DeleteRowButton } from "@/components/delete-row-button";
import { EditableRow } from "@/components/editable-row";
import { PageShell } from "@/components/page-shell";
import { RecordForm, type Field } from "@/components/record-form";
import { isClosed } from "@/lib/application-status";
import {
  EVENT_KINDS,
  buildMonthGrid,
  currentMonth,
  isMonthString,
  itemTone,
  monthLabel,
  monthRange,
  shiftMonth,
  type CalendarItem,
} from "@/lib/calendar";
import { toDateInput, toTimeInput, todayInSeoul } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";

type EventRow = {
  id: string;
  title: string;
  kind: string;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  memo: string | null;
  remind_before_min: number | null;
};

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

const EVENT_FIELDS: Field[] = [
  {
    name: "title",
    label: "일정",
    required: true,
    placeholder: "SQLD 필기 시험",
    wide: true,
  },
  {
    name: "kind",
    label: "분류",
    type: "select",
    options: [...EVENT_KINDS],
  },
  { name: "date", label: "날짜", type: "date", required: true },
  {
    name: "start_time",
    label: "시작 시각",
    type: "text",
    placeholder: "14:00",
    hint: "비우면 하루 종일로 표시됩니다",
  },
  { name: "end_time", label: "종료 시각", type: "text", placeholder: "16:00" },
  {
    name: "remind_before_min",
    label: "알림 (분 전)",
    type: "number",
    placeholder: "60",
    hint: "웹 푸시는 2차에 붙습니다. 지금은 저장만 됩니다",
  },
  { name: "memo", label: "메모", type: "textarea" },
];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const month =
    params.month && isMonthString(params.month) ? params.month : currentMonth();

  const grid = buildMonthGrid(month);
  const { fromIso, toIso } = monthRange(month);
  const firstDate = grid.find((d) => d.inMonth)!.date;
  const lastDate = [...grid].reverse().find((d) => d.inMonth)!.date;
  const today = todayInSeoul();

  const supabase = await createClient();

  const [appResult, taskResult, eventResult, specResult] = await Promise.all([
    supabase
      .from("applications")
      .select("id, company, role, status, deadline")
      .not("deadline", "is", null)
      .gte("deadline", fromIso)
      .lt("deadline", toIso),
    supabase
      .from("tasks")
      .select("id, title, due_date, done")
      .not("due_date", "is", null)
      .gte("due_date", firstDate)
      .lte("due_date", lastDate),
    supabase
      .from("events")
      .select("*")
      .gte("start_at", fromIso)
      .lt("start_at", toIso)
      .order("start_at"),
    // 목표로 삼은 시험만 가져온다. 공용 시험 전부를 띄우면 달력이 남의 일정으로 찬다.
    supabase
      .from("user_specs")
      .select("id, name, target_exam_id, exams(name, round, reg_start, reg_end, exam_date)")
      .not("target_exam_id", "is", null),
  ]);

  const events = (eventResult.data ?? []) as EventRow[];

  // 날짜별로 모은다.
  const byDate = new Map<string, CalendarItem[]>();
  const push = (date: string, item: CalendarItem) => {
    const list = byDate.get(date) ?? [];
    list.push(item);
    byDate.set(date, list);
  };

  for (const row of appResult.data ?? []) {
    const app = row as {
      id: string;
      company: string;
      status: string;
      deadline: string;
    };
    // 끝난 전형의 마감일은 달력을 어지럽히기만 한다.
    if (isClosed(app.status)) continue;
    push(toDateInput(app.deadline), {
      id: `app-${app.id}`,
      type: "마감",
      label: app.company,
      time: toTimeInput(app.deadline),
      href: "/applications",
    });
  }

  for (const row of taskResult.data ?? []) {
    const task = row as {
      id: string;
      title: string;
      due_date: string;
      done: boolean;
    };
    if (task.done) continue;
    push(task.due_date, {
      id: `task-${task.id}`,
      type: "할 일",
      label: task.title,
      href: "/roadmap",
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

  // 목표 시험의 접수 시작·접수 마감·시험일을 이 달 범위 안에서만 올린다.
  for (const row of specResult.data ?? []) {
    // PostgREST 는 이어 붙인 표를 배열로 돌려준다. 여기서는 하나만 쓴다.
    const spec = row as unknown as {
      id: string;
      exams:
        | {
            name: string;
            round: string | null;
            reg_start: string | null;
            reg_end: string | null;
            exam_date: string | null;
          }
        | Array<{
            name: string;
            round: string | null;
            reg_start: string | null;
            reg_end: string | null;
            exam_date: string | null;
          }>
        | null;
    };
    const exam = Array.isArray(spec.exams) ? (spec.exams[0] ?? null) : spec.exams;
    if (!exam) continue;

    const label = [exam.name, exam.round].filter(Boolean).join(" ");
    const entries: { date: string | null; type: CalendarItem["type"]; suffix: string }[] = [
      { date: exam.reg_start, type: "접수", suffix: "접수 시작" },
      { date: exam.reg_end, type: "마감", suffix: "접수 마감" },
      { date: exam.exam_date, type: "시험", suffix: "시험일" },
    ];

    for (const entry of entries) {
      if (!entry.date) continue;
      if (entry.date < firstDate || entry.date > lastDate) continue;
      push(entry.date, {
        id: `exam-${spec.id}-${entry.suffix}`,
        type: entry.type,
        label: `${label} ${entry.suffix}`,
      });
    }
  }

  const nav = (
    <div className="flex items-center gap-1">
      <Link
        href={`/calendar?month=${shiftMonth(month, -1)}`}
        aria-label="이전 달"
        className="rounded-md border border-line p-1.5 text-ink-500 hover:bg-muted-100"
      >
        <ChevronLeft className="size-4" aria-hidden />
      </Link>
      <Link
        href="/calendar"
        className="rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink-500 hover:bg-muted-100"
      >
        이번 달
      </Link>
      <Link
        href={`/calendar?month=${shiftMonth(month, 1)}`}
        aria-label="다음 달"
        className="rounded-md border border-line p-1.5 text-ink-500 hover:bg-muted-100"
      >
        <ChevronRight className="size-4" aria-hidden />
      </Link>
    </div>
  );

  const daysWithItems = grid.filter(
    (day) => day.inMonth && (byDate.get(day.date)?.length ?? 0) > 0,
  );

  return (
    <PageShell title={monthLabel(month)} description="마감·할 일·일정을 한 화면에서 봅니다." actions={nav}>
      {/* ---------------- 데스크톱: 월간 격자 ---------------- */}
      <div className="hidden md:block">
        <div className="grid grid-cols-7 border-t border-l border-line">
          {WEEKDAY_LABELS.map((label, index) => (
            <div
              key={label}
              className={
                "border-r border-b border-line bg-muted-100 px-2 py-1.5 text-center text-xs font-medium " +
                (index === 5
                  ? "text-brand-600"
                  : index === 6
                    ? "text-danger-600"
                    : "text-ink-500")
              }
            >
              {label}
            </div>
          ))}

          {grid.map((day) => {
            const items = byDate.get(day.date) ?? [];
            const isToday = day.date === today;
            return (
              <div
                key={day.date}
                className={
                  "min-h-24 border-r border-b border-line p-1.5 " +
                  (day.inMonth ? "" : "bg-muted-100/60")
                }
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={
                      "inline-flex size-5 items-center justify-center rounded-full text-xs " +
                      (isToday
                        ? "bg-brand-600 font-bold text-white"
                        : day.inMonth
                          ? day.weekday === 0
                            ? "text-danger-600"
                            : day.weekday === 6
                              ? "text-brand-600"
                              : "text-ink-700"
                          : "text-ink-400")
                    }
                  >
                    {Number(day.date.slice(8))}
                  </span>
                </div>

                <ul className="flex flex-col gap-0.5">
                  {items.slice(0, 3).map((item) => (
                    <li key={item.id}>
                      <span
                        className={
                          "block truncate rounded px-1 py-0.5 text-[11px] " +
                          itemTone(item.type)
                        }
                        title={`${item.type} · ${item.label}`}
                      >
                        {item.time ? `${item.time} ` : ""}
                        {item.label}
                      </span>
                    </li>
                  ))}
                  {items.length > 3 ? (
                    <li className="px-1 text-[11px] text-ink-400">
                      +{items.length - 3}건
                    </li>
                  ) : null}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------------- 모바일: 날짜별 목록 ---------------- */}
      <div className="md:hidden">
        {daysWithItems.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-surface px-4 py-10 text-center text-sm text-ink-500">
            이 달에는 표시할 일정이 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {daysWithItems.map((day) => {
              const items = byDate.get(day.date) ?? [];
              const isToday = day.date === today;
              return (
                <li key={day.date}>
                  <p
                    className={
                      "mb-1.5 text-sm font-medium " +
                      (isToday ? "text-brand-600" : "text-ink-700")
                    }
                  >
                    {Number(day.date.slice(5, 7))}월 {Number(day.date.slice(8))}일
                    {" ("}
                    {WEEKDAY_LABELS[(day.weekday + 6) % 7]}
                    {")"}
                    {isToday ? " · 오늘" : ""}
                  </p>
                  <ul className="flex flex-col gap-1">
                    {items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center gap-2 rounded-md border border-line px-2 py-1.5"
                      >
                        <span
                          className={
                            "shrink-0 rounded px-1.5 py-0.5 text-[11px] " +
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
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ---------------- 내가 넣은 일정 ---------------- */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold">
          이 달의 내 일정{" "}
          <span className="text-sm font-normal text-ink-400">
            {events.length}
          </span>
        </h2>

        {events.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-surface px-4 py-6 text-center text-sm text-ink-500">
            직접 넣은 일정이 없습니다. 시험일이나 면접 일정을 추가해 보세요.
            <br />
            마감과 할 일은 지원 현황·로드맵에서 자동으로 올라옵니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {events.map((event) => (
              <li key={event.id}>
                <EditableRow
                  action={updateEvent}
                  fields={EVENT_FIELDS}
                  defaults={{
                    title: event.title,
                    kind: event.kind,
                    date: toDateInput(event.start_at),
                    start_time: event.all_day ? "" : toTimeInput(event.start_at),
                    end_time: event.end_at ? toTimeInput(event.end_at) : "",
                    remind_before_min:
                      event.remind_before_min === null
                        ? ""
                        : String(event.remind_before_min),
                    memo: event.memo,
                  }}
                  id={event.id}
                  title={event.title}
                  deleteSlot={
                    <DeleteRowButton
                      action={removeEvent}
                      id={event.id}
                      label={event.title}
                    />
                  }
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      <span
                        className={
                          "mr-2 rounded px-1.5 py-0.5 text-[11px] " +
                          itemTone(event.kind as CalendarItem["type"])
                        }
                      >
                        {event.kind}
                      </span>
                      {event.title}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-500">
                      {toDateInput(event.start_at)}
                      {event.all_day
                        ? " · 하루 종일"
                        : ` · ${toTimeInput(event.start_at)}${
                            event.end_at ? `~${toTimeInput(event.end_at)}` : ""
                          }`}
                      {event.remind_before_min !== null
                        ? ` · ${event.remind_before_min}분 전 알림`
                        : ""}
                    </p>
                    {event.memo ? (
                      <p className="mt-2 text-sm wrap-anywhere whitespace-pre-wrap text-ink-500">
                        {event.memo}
                      </p>
                    ) : null}
                  </div>
                </EditableRow>
              </li>
            ))}
          </ul>
        )}

        <RecordForm
          action={addEvent}
          fields={EVENT_FIELDS}
          openLabel="일정 추가"
        />
      </section>
    </PageShell>
  );
}
