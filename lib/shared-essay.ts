/* ============================================================
   공용 자소서 — 붙여넣은 글을 문항 단위로 나누고, 위험한 값을 찾아낸다.

   전부 규칙 기반이다. AI 를 쓰지 않는다.
   공용 자소서도 남이 쓴 글이므로 AI API 로 보내지 않는다 (CLAUDE.md 3장 5번).
   ============================================================ */

export const SHARED_RESULTS = [
  "서류 합격",
  "최종 합격",
  "불합격",
  "모름",
] as const;

export type SharedResult = (typeof SHARED_RESULTS)[number];

export const VISIBILITIES = [
  { value: "admin", label: "운영자만" },
  { value: "all", label: "전체 사용자" },
] as const;

/** 사용자 화면에 내려보내는 공용 자소서. 출처 메모는 일부러 빠져 있다. */
export type SharedEssay = {
  id: string;
  company: string;
  role: string | null;
  season: string | null;
  question: string;
  char_limit: number | null;
  answer: string;
  category: string | null;
  result: string;
};

export type ParsedEssay = {
  question: string;
  answer: string;
  charLimit: number | null;
  category: string | null;
};

/* ------------------------------------------------------------
   글자 수 제한 찾기
   "(500자)", "[1,000자 이내]", "공백 포함 700자" 같은 표기를 읽는다.
   ------------------------------------------------------------ */
export function findCharLimit(text: string): number | null {
  // 숫자에 쉼표가 들어가는 경우가 많다.
  const match = text.match(/([0-9][0-9,]{1,6})\s*자/);
  if (!match) return null;

  const value = Number.parseInt(match[1].replace(/,/g, ""), 10);
  if (Number.isNaN(value)) return null;
  // 너무 작거나 큰 값은 글자 수 제한이 아니라 본문 속 숫자일 가능성이 높다.
  if (value < 50 || value > 20000) return null;
  return value;
}

/* ------------------------------------------------------------
   문항 유형 추측
   맞히지 못하면 null 로 두고 사람이 고르게 한다. 억지로 넣지 않는다.
   ------------------------------------------------------------ */
const CATEGORY_HINTS: { category: string; words: string[] }[] = [
  { category: "지원동기", words: ["지원 동기", "지원동기", "지원한 이유", "왜 우리", "지원하게 된"] },
  { category: "성장과정", words: ["성장 과정", "성장과정", "살아온", "자라온"] },
  { category: "성격 장단점", words: ["장단점", "장점과 단점", "성격의", "강점과 약점"] },
  { category: "직무역량", words: ["직무", "역량", "전문성", "준비해 온", "직무 관련"] },
  { category: "협업·갈등", words: ["협업", "갈등", "팀워크", "소통", "함께 일"] },
  { category: "도전·실패", words: ["도전", "실패", "어려움", "극복", "가장 힘들"] },
  { category: "입사 후 포부", words: ["입사 후", "포부", "비전", "10년 후", "이루고 싶"] },
];

export function guessCategory(question: string): string | null {
  const text = question.replace(/\s+/g, " ");
  for (const hint of CATEGORY_HINTS) {
    if (hint.words.some((word) => text.includes(word))) return hint.category;
  }
  return null;
}

/* ------------------------------------------------------------
   문항 줄인지 알아보기

   자소서 파일에서 문항은 보통 이런 모습이다.
     # 1. 지원 동기를 기술하시오 (500자)
     [1] 성장 과정
     1. 직무 역량을 ...
     Q1. ...
     문항 2) ...
   ------------------------------------------------------------ */
const HEADING = /^#{1,6}\s+/;
const NUMBERED = /^\s*(?:Q|q|문항|문\s*항)?\s*\[?\(?\d{1,2}\)?[.)\]]\s*\S/;
const BRACKETED = /^\s*[[【<(]\s*\S.*[\]】>)]\s*$/;

function isQuestionLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  // 너무 긴 줄은 문항이 아니라 답변 본문이다.
  if (trimmed.length > 200) return false;

  if (HEADING.test(trimmed)) return true;
  if (NUMBERED.test(trimmed)) return true;
  if (BRACKETED.test(trimmed) && trimmed.length <= 120) return true;

  // 물음표로 끝나거나 "~시오/~주세요" 로 끝나는 짧은 줄
  if (
    trimmed.length <= 200 &&
    /(\?|하시오\.?|하십시오\.?|기술하시오\.?|서술하시오\.?|작성해\s*주세요\.?|주십시오\.?|설명하시오\.?)$/.test(
      trimmed,
    )
  ) {
    return true;
  }

  return false;
}

/** 문항 줄에서 장식을 떼어 낸다. */
function cleanQuestion(line: string): string {
  return line
    .trim()
    .replace(HEADING, "")
    .replace(/^\s*(?:Q|q|문항|문\s*항)?\s*\[?\(?\d{1,2}\)?[.)\]]\s*/, "")
    .replace(/^\*\*|\*\*$/g, "")
    .trim();
}

/**
 * 붙여넣은 글 한 덩어리를 문항별로 나눈다.
 *
 * 문항을 하나도 못 찾으면 전체를 답변 하나로 돌려준다.
 * 사람이 미리보기에서 고칠 수 있으므로, 억지로 쪼개지 않는 쪽이 낫다.
 */
export function splitQuestions(raw: string): ParsedEssay[] {
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  const lines = text.split("\n");
  const blocks: { question: string; body: string[] }[] = [];
  let current: { question: string; body: string[] } | null = null;

  for (const line of lines) {
    if (isQuestionLine(line)) {
      if (current) blocks.push(current);
      current = { question: cleanQuestion(line), body: [] };
      continue;
    }
    if (current) current.body.push(line);
  }
  if (current) blocks.push(current);

  // 문항을 못 찾았으면 통째로 하나
  if (blocks.length === 0) {
    return [
      {
        question: "",
        answer: text,
        charLimit: null,
        category: null,
      },
    ];
  }

  return blocks
    .map((block) => {
      const answer = block.body.join("\n").trim();
      const question = block.question.trim();
      return {
        question,
        answer,
        // 글자 수 표기는 문항 줄에 붙는 경우가 대부분이다.
        charLimit: findCharLimit(question),
        category: guessCategory(question),
      };
    })
    // 답변이 아예 없는 덩어리는 제목 줄만 있었던 것이라 버린다.
    .filter((item) => item.answer.length > 0);
}

/* ------------------------------------------------------------
   위험한 값 찾기

   남이 준 자소서를 그대로 올리면 연락처가 섞여 들어올 수 있다.
   저장하기 전에 찾아서 보여 준다. 지우는 것은 사람이 판단한다.
   ------------------------------------------------------------ */
export type SensitiveHit = {
  kind: string;
  sample: string;
};

const PATTERNS: { kind: string; regex: RegExp }[] = [
  { kind: "전화번호", regex: /\b01[016-9][-.\s]?\d{3,4}[-.\s]?\d{4}\b/g },
  { kind: "일반 전화", regex: /\b0(?:2|[3-6][1-5])[-.\s]?\d{3,4}[-.\s]?\d{4}\b/g },
  { kind: "이메일", regex: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g },
  // 주민등록번호 모양. 저장 대상이 아니다 (CLAUDE.md 3장 4번).
  { kind: "주민번호 형태", regex: /\b\d{6}[-\s]?[1-4]\d{6}\b/g },
  { kind: "카카오·인스타 아이디", regex: /(?:카톡|카카오톡|카카오|인스타|insta|kakao)\s*[:：]?\s*@?[\w.]{3,}/gi },
  { kind: "주소", regex: /[가-힣]+(?:시|도)\s?[가-힣]+(?:구|군|시)\s?[가-힣0-9]+(?:동|읍|면|로|길)/g },
];

/** 본문에서 연락처처럼 보이는 것을 찾는다. 찾은 값은 가려서 돌려준다. */
export function findSensitive(text: string): SensitiveHit[] {
  if (!text) return [];

  const hits: SensitiveHit[] = [];
  const seen = new Set<string>();

  for (const { kind, regex } of PATTERNS) {
    for (const match of text.matchAll(regex)) {
      const value = match[0];
      const key = `${kind}:${value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({ kind, sample: mask(value) });
      // 같은 종류를 너무 많이 늘어놓지 않는다.
      if (hits.filter((h) => h.kind === kind).length >= 3) break;
    }
  }

  return hits;
}

/** 찾은 값을 화면에 보여 줄 때 가운데를 가린다. */
function mask(value: string): string {
  if (value.length <= 4) return value[0] + "•".repeat(value.length - 1);
  const head = value.slice(0, 3);
  const tail = value.slice(-2);
  return `${head}${"•".repeat(Math.min(value.length - 5, 8))}${tail}`;
}

/** 공백 포함 글자 수. 자소서는 보통 공백을 포함해서 센다. */
export function countChars(text: string): number {
  return text.replace(/\r\n/g, "\n").length;
}
