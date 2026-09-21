export const INTERVIEW_FORMATS = ["대면", "화상", "전화", "기타"] as const;
export const INTERVIEW_RESULTS = ["대기", "합격", "불합격"] as const;

/** 면접 질문 유형. 나중에 Gemini 자동 태깅을 붙일 때도 이 목록을 쓴다. */
export const QUESTION_CATEGORIES = [
  "자기소개",
  "지원동기",
  "직무역량",
  "인성·가치관",
  "상황대처",
  "전공·기술",
  "역질문",
  "기타",
] as const;

export type InterviewResult = (typeof INTERVIEW_RESULTS)[number];

export function resultTone(result: string): "success" | "muted" | "brand" {
  if (result === "합격") return "success";
  if (result === "불합격") return "muted";
  return "brand";
}
