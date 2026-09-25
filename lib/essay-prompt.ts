/* ============================================================
   자소서 초안용 "프롬프트 복사".

   자소서 답변 원문과 경험 뱅크는 AI API 로 보내지 않는다 (CLAUDE.md 3장 5번).
   대신 앱이 프롬프트를 조립해 클립보드에 넣어 주고,
   사용자가 자기가 쓰는 AI 채팅에 직접 붙여넣는다.
   ============================================================ */

export type PromptExperience = {
  title: string;
  org: string | null;
  role: string | null;
  period: string;
  situation: string | null;
  action: string | null;
  result: string | null;
  tags: string[];
};

export type PromptReference = {
  question: string;
  answer: string;
};

/** 공용 자소서 — 남이 쓴 글이다. 문체·구성만 참고하고 베끼지 않게 한다. */
export type PromptSharedReference = {
  company: string;
  question: string;
  answer: string;
};

export function buildEssayPrompt({
  question,
  charLimit,
  company,
  role,
  experiences,
  references,
  sharedReferences = [],
}: {
  question: string;
  charLimit: number | null;
  company: string | null;
  role: string | null;
  experiences: PromptExperience[];
  references: PromptReference[];
  sharedReferences?: PromptSharedReference[];
}): string {
  const lines: string[] = [];

  lines.push("너는 한국 기업 자기소개서 작성을 돕는다.");
  lines.push("");
  lines.push("## 지원 정보");
  lines.push(`- 기업: ${company ?? "(미정)"}`);
  lines.push(`- 직무: ${role ?? "(미정)"}`);
  lines.push("");
  lines.push("## 문항");
  lines.push(question.trim());
  lines.push("");

  if (charLimit) {
    lines.push(`## 글자 수`);
    lines.push(`- 공백 포함 ${charLimit}자 이내로 쓴다. 넘기지 않는다.`);
    lines.push(`- ${Math.floor(charLimit * 0.9)}자 이상은 채운다.`);
    lines.push("");
  }

  lines.push("## 쓸 수 있는 내 경험");
  if (experiences.length === 0) {
    lines.push("(선택한 경험이 없다)");
  } else {
    experiences.forEach((exp, index) => {
      lines.push(
        `### 경험 ${index + 1}: ${exp.title}${exp.org ? ` (${exp.org})` : ""}`,
      );
      if (exp.period) lines.push(`- 기간: ${exp.period}`);
      if (exp.role) lines.push(`- 역할: ${exp.role}`);
      if (exp.situation) lines.push(`- 상황: ${exp.situation}`);
      if (exp.action) lines.push(`- 행동: ${exp.action}`);
      if (exp.result) lines.push(`- 결과: ${exp.result}`);
      if (exp.tags.length > 0) lines.push(`- 키워드: ${exp.tags.join(", ")}`);
      lines.push("");
    });
  }

  if (references.length > 0) {
    lines.push("## 참고할 내 예전 자소서 (문체 참고용)");
    references.forEach((ref, index) => {
      lines.push(`### 참고 ${index + 1}`);
      lines.push(`- 문항: ${ref.question}`);
      lines.push(`- 답변: ${ref.answer}`);
      lines.push("");
    });
  }

  if (sharedReferences.length > 0) {
    lines.push("## 다른 사람 자소서 (구성·흐름만 참고, 절대 베끼지 마라)");
    sharedReferences.forEach((ref, index) => {
      lines.push(`### 남의 글 ${index + 1} — ${ref.company}`);
      lines.push(`- 문항: ${ref.question}`);
      lines.push(`- 답변: ${ref.answer}`);
      lines.push("");
    });
  }

  lines.push("## 반드시 지킬 규칙");
  lines.push(
    "1. **제공한 경험에 없는 사실·수치는 절대 쓰지 마라.** 지어내면 면접에서 그대로 무너진다.",
  );
  lines.push(
    "2. 숫자가 필요한데 위에 없으면 지어내지 말고 `[숫자 확인 필요]` 라고 표시해 둬라.",
  );
  if (charLimit) {
    lines.push(`3. 공백 포함 ${charLimit}자를 넘기지 마라. 다 쓴 뒤 글자 수를 세어 알려 줘라.`);
  } else {
    lines.push("3. 다 쓴 뒤 글자 수를 세어 알려 줘라.");
  }
  lines.push("4. 회사 이름을 억지로 반복하지 마라.");
  lines.push("5. 과장된 표현(최고, 혁신적, 열정적)보다 구체적인 사실을 써라.");
  lines.push("6. 결과를 먼저 말하고 과정을 설명하는 순서로 써라.");
  if (sharedReferences.length > 0) {
    lines.push(
      "7. **다른 사람 자소서의 문장을 그대로 가져오지 마라.** 구성과 흐름만 참고하고, 내용은 위의 내 경험으로만 채워라. 표절 검사에 걸린다.",
    );
  }
  lines.push("");
  lines.push("위 조건으로 자기소개서 답변 초안을 하나 써 줘.");

  return lines.join("\n");
}

/* ============================================================
   프로필 일괄 입력용 프롬프트 (CLAUDE.md 7장).
   이력서 원문도 AI API 로 보내지 않는다. 사용자가 직접 자기 AI 채팅에 넣는다.
   ============================================================ */

export const PROFILE_IMPORT_SCHEMA = `{
  "education": [
    {
      "school": "학교 이름",
      "major": "전공 또는 null",
      "degree": "학사 | 전문학사 | 석사 | 박사 | 고졸 중 하나, 모르면 null",
      "start_date": "YYYY-MM-DD 또는 null",
      "end_date": "YYYY-MM-DD 또는 null (재학 중이면 null)",
      "gpa": "3.8/4.5 같은 문자열 또는 null",
      "key_courses": "주요 과목을 쉼표로 이은 문자열 또는 null"
    }
  ],
  "experiences": [
    {
      "title": "경험 제목",
      "org": "소속 또는 null",
      "period_start": "YYYY-MM-DD 또는 null",
      "period_end": "YYYY-MM-DD 또는 null",
      "role": "맡은 역할 또는 null",
      "situation": "어떤 상황이었는지 또는 null",
      "action": "무엇을 했는지 또는 null",
      "result": "어떤 결과가 났는지 또는 null",
      "tags": ["키워드", "최대 5개"]
    }
  ]
}`;

export function buildProfileImportPrompt(): string {
  return [
    "너는 이력서에서 사실만 뽑아 JSON 으로 정리하는 도구다.",
    "",
    "## 할 일",
    "아래 <이력서> 안의 내용을 읽고, 학력과 경험을 JSON 으로 정리해라.",
    "",
    "## 반드시 지킬 규칙",
    "1. **이력서에 없는 내용은 절대 지어내지 마라.** 모르면 null 을 넣어라.",
    "2. 날짜는 YYYY-MM-DD 로 쓴다. 연월만 있으면 그 달 1일로 둔다.",
    "3. 경험은 상황(situation)·행동(action)·결과(result)로 나눠 적는다.",
    "   이력서에 그렇게 나뉘어 있지 않으면 내용을 옮겨 적되 없는 항목은 null 로 둔다.",
    "4. **JSON 만 출력해라.** 설명, 인사말, 코드블록 표시 없이 JSON 그 자체만.",
    "",
    "## 출력 형식",
    PROFILE_IMPORT_SCHEMA,
    "",
    "<이력서>",
    "여기에 이력서 내용을 붙여넣으세요.",
    "</이력서>",
  ].join("\n");
}
