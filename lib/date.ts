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
