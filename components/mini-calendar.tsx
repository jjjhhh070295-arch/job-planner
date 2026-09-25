import Link from "next/link";

import { buildMonthGrid, monthLabel } from "@/lib/calendar";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * 대시보드에 올리는 작은 달력.
 * 일정이 있는 날에만 점을 찍는다. 자세한 내용은 캘린더 화면에서 본다.
 */
export function MiniCalendar({
  month,
  today,
  markedDates,
  urgentDates,
}: {
  month: string;
  today: string;
  /** 무엇이든 있는 날 */
  markedDates: Set<string>;
  /** 마감이 임박한 날 (빨강 점) */
  urgentDates: Set<string>;
}) {
  const grid = buildMonthGrid(month);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-bold">{monthLabel(month)}</p>
        <Link
          href="/calendar"
          className="px-1 py-2 text-xs font-medium text-brand-600 hover:underline"
        >
          캘린더
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {WEEKDAYS.map((label, index) => (
          <div
            key={label}
            className={
              "pb-1 text-center text-[11px] font-medium " +
              (index === 0 ? "text-danger-600" : "text-ink-400")
            }
          >
            {label}
          </div>
        ))}

        {grid.map((day) => {
          const isToday = day.date === today;
          const marked = markedDates.has(day.date);
          const urgent = urgentDates.has(day.date);

          return (
            <div key={day.date} className="flex flex-col items-center gap-0.5">
              <span
                className={
                  "flex size-7 items-center justify-center rounded-md text-xs " +
                  (isToday
                    ? "bg-brand-600 font-bold text-white"
                    : day.inMonth
                      ? day.weekday === 0
                        ? "text-danger-600"
                        : "text-ink-700"
                      : "text-ink-400/50")
                }
              >
                {Number(day.date.slice(8))}
              </span>
              <span
                className={
                  "size-1 rounded-full " +
                  (!day.inMonth || !marked
                    ? "bg-transparent"
                    : urgent
                      ? "bg-danger-600"
                      : "bg-brand-500")
                }
                aria-hidden
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
