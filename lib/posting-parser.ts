/* ============================================================
   채용공고 파싱.

   정확도를 위해 세 겹으로 막는다.
   1) responseSchema 로 답의 모양을 강제한다
   2) 프롬프트에서 "모르면 null", "근거 원문을 글자 그대로 인용" 을 요구한다
   3) 받은 인용이 실제로 공고 안에 있는 문장인지 프로그램이 대조한다
      -> 없는 문장을 근거로 댄 항목은 "확인 필요" 로 표시해 사람이 보게 한다
   ============================================================ */

const valueWithQuote = {
  type: "object",
  properties: {
    value: { type: "string", nullable: true },
    quote: { type: "string", nullable: true },
  },
  required: ["value", "quote"],
} as const;

export const POSTING_SCHEMA = {
  type: "object",
  properties: {
    company: valueWithQuote,
    role: valueWithQuote,
    season: valueWithQuote,
    deadline: {
      type: "object",
      properties: {
        value: { type: "string", nullable: true },
        quote: { type: "string", nullable: true },
        note: { type: "string", nullable: true },
      },
      required: ["value", "quote", "note"],
    },
    essay_questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          char_limit: { type: "integer", nullable: true },
          quote: { type: "string" },
        },
        required: ["question", "char_limit", "quote"],
      },
    },
    language_requirements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          requirement: { type: "string" },
          quote: { type: "string" },
        },
        required: ["name", "requirement", "quote"],
      },
    },
    other_requirements: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "company",
    "role",
    "season",
    "deadline",
    "essay_questions",
    "language_requirements",
    "other_requirements",
  ],
} as const;

export type Quoted = { value: string | null; quote: string | null };

export type ParsedPosting = {
  company: Quoted;
  role: Quoted;
  season: Quoted;
  deadline: Quoted & { note: string | null };
  essay_questions: {
    question: string;
    char_limit: number | null;
    quote: string;
  }[];
  language_requirements: {
    name: string;
    requirement: string;
    quote: string;
  }[];
  other_requirements: string[];
};

/** 공고 본문 길이 상한. 너무 길면 응답이 느려지고 잘릴 위험이 커진다. */
export const MAX_POSTING_LENGTH = 20_000;

export function buildPostingPrompt(today: string, text: string): string {
  return `너는 한국 기업 채용공고에서 사실만 뽑아내는 도구다.

오늘 날짜는 ${today} (Asia/Seoul) 이다.

규칙:
- 공고에 적혀 있지 않은 것은 절대 지어내지 마라. 모르면 반드시 null 을 넣어라.
- 모든 항목의 quote 에는 근거가 된 원문을 **글자 그대로** 잘라 넣어라. 요약하거나 고쳐 쓰지 마라.
- deadline 은 서류접수(지원서) 마감 시각이다. 면접일이나 발표일이 아니다.
  "YYYY-MM-DDTHH:mm" 형식으로 쓰고, 시각이 없으면 T23:59 로 둔다.
  연도가 없으면 오늘 날짜를 기준으로 가장 가까운 미래로 판단한다.
  "채용시 마감", "상시채용" 처럼 확정 날짜가 없으면 value 는 null 로 두고 note 에 그 표현을 적는다.
- season 은 "2026 상반기" 처럼 연도와 상/하반기를 합쳐 적는다.
  상/하반기 구분이 없으면 연도만 적는다. 연도도 없으면 null.
- role 은 모집 직무다. 여러 개면 " / " 로 이어 적는다.
- essay_questions 는 자기소개서 문항이다. 번호와 글자 수 안내는 question 에서 빼고 질문 문장만 남겨라.
  char_limit 은 숫자만 넣는다. "1,000자" 는 1000 이다. "공백 포함 700자" 는 700 이다.
  글자 수 제한이 없으면 null. 자기소개서 문항이 없으면 빈 배열.
- language_requirements 는 어학 요건이다. name 은 시험 이름, requirement 는 요구 수준과 조건이다.
- other_requirements 는 학력·전공·자격증·경력처럼 그 밖의 지원 자격을 한 줄씩 적는다.

공고 원문:
"""
${text}
"""`;
}

/** 공백과 줄바꿈을 지우고 비교한다. 모델이 줄을 붙여 인용하는 일이 흔하다. */
function normalize(text: string): string {
  return text.replace(/\s+/g, "");
}

export type FieldCheck = {
  /** 근거 인용이 실제 공고에 있었는지 */
  grounded: boolean;
  quote: string | null;
};

export type ParseChecks = {
  company: FieldCheck;
  role: FieldCheck;
  season: FieldCheck;
  deadline: FieldCheck;
  essay_questions: FieldCheck[];
  language_requirements: FieldCheck[];
  /** 근거가 확인되지 않은 항목 수 */
  ungroundedCount: number;
};

/**
 * 모델이 댄 근거가 실제로 공고 안에 있는 문장인지 대조한다.
 * 모델을 한 번 더 부르는 것보다 빠르고, 결과가 사람마다 달라지지 않는다.
 */
export function verifyQuotes(
  parsed: ParsedPosting,
  source: string,
): ParseChecks {
  const haystack = normalize(source);

  const check = (quote: string | null | undefined): FieldCheck => {
    if (!quote) return { grounded: true, quote: null }; // 인용이 없으면 따질 것도 없다
    return { grounded: haystack.includes(normalize(quote)), quote };
  };

  const checks: ParseChecks = {
    company: check(parsed.company?.quote),
    role: check(parsed.role?.quote),
    season: check(parsed.season?.quote),
    deadline: check(parsed.deadline?.quote),
    essay_questions: (parsed.essay_questions ?? []).map((q) => check(q.quote)),
    language_requirements: (parsed.language_requirements ?? []).map((l) =>
      check(l.quote),
    ),
    ungroundedCount: 0,
  };

  checks.ungroundedCount = [
    checks.company,
    checks.role,
    checks.season,
    checks.deadline,
    ...checks.essay_questions,
    ...checks.language_requirements,
  ].filter((c) => c.quote !== null && !c.grounded).length;

  return checks;
}

/** 파싱 결과에서 requirements(jsonb) 로 저장할 부분만 추린다. */
export function toRequirements(parsed: ParsedPosting) {
  return {
    language: (parsed.language_requirements ?? []).map((l) => ({
      name: l.name,
      requirement: l.requirement,
    })),
    other: parsed.other_requirements ?? [],
    deadline_note: parsed.deadline?.note ?? null,
  };
}
