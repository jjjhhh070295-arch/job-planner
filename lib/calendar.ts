import { TIME_ZONE } from "@/lib/date";

export const EVENT_KINDS = ["개인", "시험", "면접", "기타"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** "YYYY-MM" 형식인지 */
export function isMonthString(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** 서울 기준 이번 달 "YYYY-MM" */
export function currentMonth(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [year, mon] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, mon - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(month: string): string {
  const [year, mon] = month.split("-");
  return `${year}년 ${Number(mon)}월`;
}

export type Day = {
  /** "YYYY-MM-DD" */
  date: string;
  /** 이 달에 속한 날인지 (앞뒤 달 채움이면 false) */
  inMonth: boolean;
  weekday: number; // 0=일
};

/**
 * 달력 격자. 월요일 시작, 앞뒤 달로 채워 6주(42칸)를 만든다.
 * 주 수가 달마다 달라지면 화면 높이가 출렁여서 보기 불편하다.
 */
export function buildMonthGrid(month: string): Day[] {
  const [year, mon] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, mon - 1, 1));

  // 월요일을 주의 시작으로 본다. getUTCDay: 0=일
  const weekday = first.getUTCDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;

  const start = new Date(first);
  start.setUTCDate(start.getUTCDate() + offset);

  const days: Day[] = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    days.push({
      date: d.toISOString().slice(0, 10),
      inMonth: d.getUTCMonth() === mon - 1 && d.getUTCFullYear() === year,
      weekday: d.getUTCDay(),
    });
  }
  return days;
}

/** 그 달의 첫날과 마지막날 다음날 (조회 범위용, 서울 기준 경계) */
export function monthRange(month: string): { fromIso: string; toIso: string } {
  const [year, mon] = month.split("-").map(Number);
  // 서울은 UTC+9 이므로 서울 자정은 UTC 로 전날 15:00
  const from = new Date(Date.UTC(year, mon - 1, 1, 0, 0, 0));
  from.setUTCHours(from.getUTCHours() - 9);
  const to = new Date(Date.UTC(year, mon, 1, 0, 0, 0));
  to.setUTCHours(to.getUTCHours() - 9);
  return { fromIso: from.toISOString(), toIso: to.toISOString() };
}

export type CalendarItem = {
  id: string;
  /** 표시 색과 묶음 */
  type: "마감" | "할 일" | "시험" | "면접" | "개인" | "기타";
  label: string;
  /** 시각이 있으면 "18:00" */
  time?: string;
  href?: string;
};

/** CLAUDE.md UX 원칙에 맞춘 색. 마감은 빨강, 할 일은 파랑. */
export function itemTone(type: CalendarItem["type"]): string {
  switch (type) {
    case "마감":
      return "bg-red-100 text-red-800";
    case "할 일":
      return "bg-blue-100 text-blue-800";
    case "시험":
      return "bg-purple-100 text-purple-800";
    case "면접":
      return "bg-amber-100 text-amber-900";
    default:
      return "bg-gray-100 text-gray-700";
  }
}
