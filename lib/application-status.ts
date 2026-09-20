/**
 * 전형 단계. CLAUDE.md 4장의 칸반 순서를 따르고 탈락만 뒤에 더했다.
 * "use server" 파일은 함수 외의 값을 내보낼 수 없어서 별도 모듈로 둔다.
 */
export const STATUSES = [
  "작성 중",
  "제출",
  "서류 합격",
  "면접",
  "최종 합격",
  "탈락",
] as const;

export type Status = (typeof STATUSES)[number];

/** 끝난 전형인지. 마감일을 강조하지 않을 때 쓴다. */
export function isClosed(status: string): boolean {
  return status === "탈락" || status === "최종 합격";
}
