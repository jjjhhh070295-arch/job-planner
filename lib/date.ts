/**
 * 서버 시간대는 Vercel 에서 UTC 다. 그대로 표시하면 한국 사용자에게 9시간 어긋난
 * 날짜가 보이므로, 날짜/시각 표시는 항상 서울 기준으로 계산한다.
 */
export const TIME_ZONE = "Asia/Seoul";

/** 서울 기준 "YYYY-MM-DD" */
function seoulDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** timestamptz 를 date 입력칸에 넣을 "YYYY-MM-DD" 로 (서울 기준) */
export function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  return seoulDateString(new Date(iso));
}

/** timestamptz 를 time 입력칸에 넣을 "HH:MM" 으로 (서울 기준) */
export function toTimeInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("hour")}:${get("minute")}`;
}

/** 서울 기준 오늘 날짜 "YYYY-MM-DD" */
export function todayInSeoul(): string {
  return seoulDateString(new Date());
}

/** 그 날짜가 속한 주의 월요일 "YYYY-MM-DD" */
export function mondayOf(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00Z`);
  // getUTCDay: 0=일요일. 월요일을 주의 시작으로 본다.
  const weekday = date.getUTCDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

/** timestamptz -> "2026.10.15 18:00" (서울 기준) */
export function formatDeadline(iso: string): string {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}.${get("month")}.${get("day")} ${get("hour")}:${get("minute")}`;
}

/** 서울 기준 날짜로 따진 남은 일수. */
export function daysUntilTimestamp(iso: string): number {
  const target = seoulDateString(new Date(iso));
  const today = seoulDateString(new Date());
  return Math.round(
    (new Date(`${target}T00:00:00Z`).getTime() -
      new Date(`${today}T00:00:00Z`).getTime()) /
      86_400_000,
  );
}

/** "2024-03-01" -> "2024.03" */
export function formatYearMonth(value: string | null | undefined): string {
  if (!value) return "";
  const [year, month] = value.split("-");
  if (!year || !month) return value;
  return `${year}.${month}`;
}

/** 기간 표기. 끝이 없으면 "진행 중" 으로 본다. */
export function formatPeriod(
  start: string | null | undefined,
  end: string | null | undefined,
  openLabel = "진행 중",
): string {
  const from = formatYearMonth(start);
  const to = end ? formatYearMonth(end) : openLabel;
  if (!from && !end) return "";
  if (!from) return to;
  return `${from} ~ ${to}`;
}

/** 오늘부터 그 날짜까지 남은 일수. 지난 날짜는 음수. */
export function daysUntil(value: string): number {
  const target = new Date(`${value}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export type Urgency = "expired" | "soon" | "normal";

/**
 * 유효기간이나 마감일의 급한 정도.
 * CLAUDE.md UX 원칙에 따라 급한 것만 빨강으로 쓴다.
 */
export function urgencyOf(value: string, soonDays = 60): Urgency {
  const days = daysUntil(value);
  if (days < 0) return "expired";
  if (days <= soonDays) return "soon";
  return "normal";
}

export function dDayLabel(value: string): string {
  const days = daysUntil(value);
  if (days === 0) return "D-DAY";
  return days > 0 ? `D-${days}` : `D+${-days}`;
}
