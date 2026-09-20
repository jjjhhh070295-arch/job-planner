/**
 * 자소서 문항 유형.
 * 1차에서는 사용자가 직접 고른다. 나중에 Gemini 가 문항 텍스트만 보고
 * 자동으로 태깅하게 되면 이 목록을 그대로 쓴다 (CLAUDE.md 7장).
 */
export const ESSAY_CATEGORIES = [
  "지원동기",
  "성장과정",
  "성격 장단점",
  "직무역량",
  "협업·갈등",
  "도전·실패",
  "입사 후 포부",
  "기타",
] as const;

export type EssayCategory = (typeof ESSAY_CATEGORIES)[number];
