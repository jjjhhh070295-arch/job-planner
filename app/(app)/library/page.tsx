import Link from "next/link";

import {
  addEssay,
  removeEssay,
  saveEssayDraft,
  toggleEssayFinal,
  updateEssay,
} from "./actions";
import { DeleteRowButton } from "@/components/delete-row-button";
import { LibraryTabs } from "@/components/library-tabs";
import { EditableRow } from "@/components/editable-row";
import { EssayFinalToggle } from "@/components/essay-final-toggle";
import {
  PromptBuilder,
  type ExperienceOption,
  type SharedReferenceOption,
} from "@/components/prompt-builder";
import { PageShell } from "@/components/page-shell";
import { RecordForm, type Field } from "@/components/record-form";
import { Tag, btnPrimary, inputClass } from "@/components/ui/primitives";
import { formatPeriod } from "@/lib/date";
import { ESSAY_CATEGORIES } from "@/lib/essay-category";
import { createOwnClient } from "@/lib/supabase/server";

type Essay = {
  id: string;
  application_id: string | null;
  question: string;
  char_limit: number | null;
  category: string | null;
  answer: string | null;
  is_final: boolean;
  is_ai_draft: boolean;
  source_experience_ids: string[];
};

type InterviewQuestion = {
  id: string;
  interview_id: string;
  question: string;
  my_answer: string | null;
  improvement: string | null;
  category: string | null;
};

type ApplicationOption = {
  id: string;
  company: string;
  role: string | null;
  season: string | null;
};

/**
 * PostgREST 의 or 필터는 쉼표와 괄호로 조건을 구분한다.
 * 검색어에 그런 글자가 있으면 필터가 깨지므로 미리 걸러낸다.
 */
function safeKeyword(raw: string): string {
  return raw.replace(/[,()*\\]/g, " ").trim().slice(0, 50);
}

const KINDS = [
  { value: "", label: "전체" },
  { value: "essay", label: "자소서만" },
  { value: "interview", label: "면접 질문만" },
];

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    app?: string;
    kind?: string;
  }>;
}) {
  const params = await searchParams;
  const keyword = safeKeyword(params.q ?? "");
  const category = params.category ?? "";
  const applicationId = params.app ?? "";
  const kind = params.kind ?? "";

  const { supabase, userId } = await createOwnClient();

  const { data: applicationData } = await supabase
    .from("applications")
    .select("id, company, role, season")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const applications = (applicationData ?? []) as ApplicationOption[];
  const companyById = new Map(
    applications.map((item) => [
      item.id,
      [item.company, item.role].filter(Boolean).join(" · "),
    ]),
  );

  /* ---------------- 자소서 ---------------- */
  let essayQuery = supabase
    .from("essays")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (keyword) {
    // 한국어는 부분 일치가 잘 맞아서 ilike 를 쓴다. trigram 인덱스가 받쳐 준다.
    essayQuery = essayQuery.or(
      `question.ilike.%${keyword}%,answer.ilike.%${keyword}%`,
    );
  }
  if (category) essayQuery = essayQuery.eq("category", category);
  if (applicationId) essayQuery = essayQuery.eq("application_id", applicationId);

  /* ---------------- 면접 질문 ---------------- */
  let interviewQuery = supabase
    .from("interview_questions")
    .select("id, interview_id, question, my_answer, improvement, category")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (keyword) {
    interviewQuery = interviewQuery.or(
      `question.ilike.%${keyword}%,my_answer.ilike.%${keyword}%,improvement.ilike.%${keyword}%`,
    );
  }

  const [essayResult, interviewResult, interviewMetaResult] = await Promise.all([
    kind === "interview" ? Promise.resolve({ data: [] }) : essayQuery,
    kind === "essay" ? Promise.resolve({ data: [] }) : interviewQuery,
    supabase
      .from("interviews")
      .select("id, stage, application_id")
      .eq("user_id", userId),
  ]);

  // 프롬프트에 넣을 재료. 경험과 자소서 원문은 AI 로 보내지 않고 화면에서 조립만 한다.
  // 공용 자소서도 마찬가지다 — 남이 쓴 글이라 더더욱 보내지 않는다 (CLAUDE.md 3장 5번).
  const [experienceResult, referenceResult, sharedResult] = await Promise.all([
    supabase
      .from("experiences")
      .select("*")
      .eq("user_id", userId)
      .order("period_start", { ascending: false }),
    supabase
      .from("essays")
      .select("id, question, answer")
      .eq("user_id", userId)
      .eq("is_final", true)
      .not("answer", "is", null)
      .limit(20),
    supabase
      .from("shared_essays")
      .select("id, company, question, answer")
      .eq("visibility", "all")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const experienceOptions: ExperienceOption[] = (experienceResult.data ?? []).map(
    (row) => {
      const r = row as Record<string, unknown>;
      return {
        id: r.id as string,
        title: r.title as string,
        org: (r.org as string | null) ?? null,
        role: (r.role as string | null) ?? null,
        period: formatPeriod(
          r.period_start as string | null,
          r.period_end as string | null,
        ),
        situation: (r.situation as string | null) ?? null,
        action: (r.action as string | null) ?? null,
        result: (r.result as string | null) ?? null,
        tags: (r.tags as string[] | null) ?? [],
      };
    },
  );

  const referenceOptions = (referenceResult.data ?? []).map((row) => {
    const r = row as { id: string; question: string; answer: string };
    return { id: r.id, question: r.question, answer: r.answer };
  });

  const sharedOptions: SharedReferenceOption[] = (sharedResult.data ?? []).map(
    (row) => {
      const r = row as {
        id: string;
        company: string;
        question: string;
        answer: string;
      };
      return {
        id: r.id,
        company: r.company,
        question: r.question,
        answer: r.answer,
      };
    },
  );

  const essays = (essayResult.data ?? []) as Essay[];
  let interviewQuestions = (interviewResult.data ?? []) as InterviewQuestion[];

  const interviewMeta = new Map(
    (interviewMetaResult.data ?? []).map((row) => {
      const r = row as {
        id: string;
        stage: string;
        application_id: string | null;
      };
      return [r.id, r];
    }),
  );

  // 기업 필터는 면접 질문에도 적용한다.
  // 질문 자체에는 기업이 없고 회차에 붙어 있어서 여기서 걸러낸다.
  if (applicationId) {
    interviewQuestions = interviewQuestions.filter(
      (q) => interviewMeta.get(q.interview_id)?.application_id === applicationId,
    );
  }

  const total = essays.length + interviewQuestions.length;
  const filtering = Boolean(keyword || category || applicationId || kind);

  const fields: Field[] = [
    {
      name: "question",
      label: "문항",
      type: "textarea",
      required: true,
      placeholder: "지원 동기와 입사 후 포부를 기술하시오.",
    },
    {
      name: "application_id",
      label: "기업",
      type: "select",
      choices: [
        { value: "", label: "선택 안 함" },
        ...applications.map((item) => ({
          value: item.id,
          label: [item.company, item.season].filter(Boolean).join(" · "),
        })),
      ],
    },
    {
      name: "category",
      label: "문항 유형",
      type: "select",
      choices: [
        { value: "", label: "선택 안 함" },
        ...ESSAY_CATEGORIES.map((item) => ({ value: item, label: item })),
      ],
    },
    {
      name: "char_limit",
      label: "글자 수 제한",
      type: "number",
      placeholder: "1000",
    },
    { name: "state", label: "상태", type: "select", options: ["초안", "최종"] },
    {
      name: "answer",
      label: "답변",
      type: "textarea",
      placeholder: "작성한 내용을 붙여넣으세요.",
    },
  ];

  return (
    <PageShell
      title="라이브러리"
      description="써 둔 자소서와 받았던 면접 질문을 한곳에서 찾습니다."
    >
      <LibraryTabs />

      {/* ---------------- 검색 ---------------- */}
      <form method="get" className="flex flex-col gap-2">
        <input
          type="search"
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="문항·답변·면접 질문에서 검색"
          className={inputClass + " h-11"}
        />

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <select
            name="kind"
            defaultValue={kind}
            className={inputClass + " h-11"}
            aria-label="종류"
          >
            {KINDS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <select
            name="category"
            defaultValue={category}
            className={inputClass + " h-11"}
            aria-label="자소서 문항 유형"
          >
            <option value="">자소서 유형 전체</option>
            {ESSAY_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            name="app"
            defaultValue={applicationId}
            className={inputClass + " h-11"}
            aria-label="기업"
          >
            <option value="">기업 전체</option>
            {applications.map((item) => (
              <option key={item.id} value={item.id}>
                {[item.company, item.season].filter(Boolean).join(" · ")}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button type="submit" className={btnPrimary + " flex-1 sm:flex-none"}>
            검색
          </button>
          {filtering ? (
            <Link
              href="/library"
              className="tap inline-flex items-center justify-center rounded-lg border border-line bg-surface px-4 text-sm font-medium text-ink-700 hover:bg-muted-100"
            >
              초기화
            </Link>
          ) : null}
        </div>
      </form>

      <p className="-mt-1 text-sm text-ink-500">
        {filtering ? "검색 결과" : "전체"} {total}건
        {total > 0
          ? ` (자소서 ${essays.length} · 면접 질문 ${interviewQuestions.length})`
          : ""}
      </p>

      {total === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-surface px-4 py-10 text-center text-sm text-ink-500">
          {filtering
            ? "조건에 맞는 것이 없습니다."
            : "아직 저장한 자소서나 면접 질문이 없습니다."}
        </p>
      ) : null}

      {/* ---------------- 자소서 ---------------- */}
      {essays.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-bold">
            자소서{" "}
            <span className="text-sm font-normal text-ink-400">
              {essays.length}
            </span>
          </h2>

          <ul className="flex flex-col gap-2">
            {essays.map((essay) => {
              const length = essay.answer?.length ?? 0;
              const over = essay.char_limit ? length > essay.char_limit : false;

              return (
                <li key={essay.id}>
                  <EditableRow
                    action={updateEssay}
                    fields={fields}
                    defaults={{
                      application_id: essay.application_id,
                      question: essay.question,
                      char_limit:
                        essay.char_limit === null
                          ? ""
                          : String(essay.char_limit),
                      category: essay.category,
                      answer: essay.answer,
                      state: essay.is_final ? "최종" : "초안",
                    }}
                    id={essay.id}
                    title={essay.question.slice(0, 20)}
                    deleteSlot={
                      <DeleteRowButton
                        action={removeEssay}
                        id={essay.id}
                        label={essay.question.slice(0, 20)}
                      />
                    }
                  >
                    <div className="min-w-0">
                      <p className="wrap-anywhere whitespace-pre-wrap font-medium">
                        {essay.question}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-ink-500">
                        {essay.application_id ? (
                          <span>
                            {companyById.get(essay.application_id) ??
                              "삭제된 기업"}
                          </span>
                        ) : null}
                        {essay.category ? (
                          <>
                            <span aria-hidden>·</span>
                            <span>{essay.category}</span>
                          </>
                        ) : null}
                        <span aria-hidden>·</span>
                        <span
                          className={over ? "font-medium text-danger-600" : ""}
                        >
                          {length}자
                          {essay.char_limit ? ` / ${essay.char_limit}자` : ""}
                          {over ? " 초과" : ""}
                        </span>
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <EssayFinalToggle
                          action={toggleEssayFinal}
                          id={essay.id}
                          isFinal={essay.is_final}
                        />
                        {essay.is_ai_draft && !essay.is_final ? (
                          <Tag tone="muted">AI 초안</Tag>
                        ) : null}
                        <PromptBuilder
                          essayId={essay.id}
                          question={essay.question}
                          charLimit={essay.char_limit}
                          company={
                            essay.application_id
                              ? (companyById.get(essay.application_id) ?? null)
                              : null
                          }
                          role={null}
                          experiences={experienceOptions}
                          references={referenceOptions.filter(
                            (r) => r.id !== essay.id,
                          )}
                          sharedReferences={sharedOptions}
                          saveDraft={saveEssayDraft}
                        />
                      </div>

                      {essay.source_experience_ids.length > 0 ? (
                        <p className="mt-2 text-xs text-ink-400">
                          출처로 쓴 경험 {essay.source_experience_ids.length}개
                          {": "}
                          {essay.source_experience_ids
                            .map(
                              (id) =>
                                experienceOptions.find((e) => e.id === id)
                                  ?.title ?? "삭제된 경험",
                            )
                            .join(", ")}
                        </p>
                      ) : null}

                      {essay.answer ? (
                        <details className="mt-3">
                          <summary className="cursor-pointer py-1 text-sm font-medium text-brand-600">
                            답변 보기
                          </summary>
                          <p className="mt-2 wrap-anywhere whitespace-pre-wrap text-sm text-ink-700">
                            {essay.answer}
                          </p>
                        </details>
                      ) : (
                        <p className="mt-3 text-sm text-ink-400">
                          아직 답변을 쓰지 않았습니다.
                        </p>
                      )}
                    </div>
                  </EditableRow>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* ---------------- 면접 질문 ---------------- */}
      {interviewQuestions.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-bold">
            면접 질문{" "}
            <span className="text-sm font-normal text-ink-400">
              {interviewQuestions.length}
            </span>
          </h2>

          <ul className="flex flex-col gap-2">
            {interviewQuestions.map((item) => {
              const meta = interviewMeta.get(item.interview_id);
              const company = meta?.application_id
                ? (companyById.get(meta.application_id) ?? "삭제된 기업")
                : "기업 미지정";

              return (
                <li
                  key={item.id}
                  className="rounded-xl border border-line bg-surface p-4"
                >
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-ink-500">
                      {company}
                      {meta?.stage ? ` · ${meta.stage}` : ""}
                    </span>
                    {item.category ? <Tag>{item.category}</Tag> : null}
                  </div>

                  <p className="wrap-anywhere whitespace-pre-wrap font-medium">
                    {item.question}
                  </p>

                  {item.my_answer ? (
                    <p className="mt-2 wrap-anywhere whitespace-pre-wrap text-sm text-ink-700">
                      {item.my_answer}
                    </p>
                  ) : null}

                  {item.improvement ? (
                    <p className="mt-2 rounded-lg bg-brand-50 px-3 py-2 wrap-anywhere whitespace-pre-wrap text-sm text-brand-700">
                      보완점 · {item.improvement}
                    </p>
                  ) : null}

                  <Link
                    href={`/interviews/${item.interview_id}`}
                    className="mt-2 inline-block py-1 text-xs font-medium text-brand-600 hover:underline"
                  >
                    이 회차로 가기
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <RecordForm action={addEssay} fields={fields} openLabel="자소서 추가" />
    </PageShell>
  );
}
