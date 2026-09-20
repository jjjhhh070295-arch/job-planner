/**
 * 마일스톤 진행률을 무엇으로 셀지.
 * "use server" 파일은 함수 외의 값을 내보낼 수 없어서 별도 모듈로 둔다.
 */
export const AUTO_SOURCES = [
  { value: "manual", label: "직접 세기" },
  { value: "applications", label: "제출한 지원 수" },
  { value: "tasks", label: "완료한 할 일 수" },
  { value: "experiences", label: "등록한 경험 수" },
  { value: "specs", label: "보유한 자격·어학 수" },
] as const;

export type AutoSource = (typeof AUTO_SOURCES)[number]["value"];

export type ProgressCounts = {
  /** 작성 중을 뺀 지원 건수 */
  applications: number;
  experiences: number;
  /** 상태가 "보유" 인 자격·어학 수 */
  specs: number;
  /** 마일스톤별 완료한 할 일 수 */
  doneTasksByMilestone: Map<string, number>;
};

export type Milestone = {
  id: string;
  title: string;
  month: string | null;
  target_value: number;
  auto_source: string;
  manual_value: number;
};

/** 마일스톤의 현재 수치. 기준에 따라 세는 대상이 다르다. */
export function currentValue(
  milestone: Milestone,
  counts: ProgressCounts,
): number {
  switch (milestone.auto_source) {
    case "applications":
      return counts.applications;
    case "tasks":
      return counts.doneTasksByMilestone.get(milestone.id) ?? 0;
    case "experiences":
      return counts.experiences;
    case "specs":
      return counts.specs;
    default:
      return milestone.manual_value;
  }
}

export function percentOf(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}

export function sourceLabel(source: string): string {
  return (
    AUTO_SOURCES.find((item) => item.value === source)?.label ?? "직접 세기"
  );
}
