import { addEssay, removeEssay, toggleEssayFinal, updateEssay } from "./actions";
import { DeleteRowButton } from "@/components/delete-row-button";
import { EditableRow } from "@/components/editable-row";
import { EssayFinalToggle } from "@/components/essay-final-toggle";
import { PageShell } from "@/components/page-shell";
import { RecordForm, type Field } from "@/components/record-form";
import { ESSAY_CATEGORIES } from "@/lib/essay-category";
import { createClient } from "@/lib/supabase/server";

type Essay = {
  id: string;
  application_id: string | null;
  question: string;
  char_limit: number | null;
  category: string | null;
  answer: string | null;
  is_final: boolean;
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

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; app?: string }>;
}) {
  const params = await searchParams;
  const keyword = safeKeyword(params.q ?? "");
  const category = params.category ?? "";
  const applicationId = params.app ?? "";

  const supabase = await createClient();

  const { data: applicationData } = await supabase
    .from("applications")
    .select("id, company, role, season")
    .order("created_at", { ascending: false });

  const applications = (applicationData ?? []) as ApplicationOption[];
  const companyById = new Map(
    applications.map((item) => [
      item.id,
      [item.company, item.role].filter(Boolean).join(" · "),
    ]),
  );

  let query = supabase
    .from("essays")
    .select("*")
    .order("created_at", { ascending: false });

  if (keyword) {
    // 한국어는 부분 일치가 잘 맞아서 ilike 를 쓴다. trigram 인덱스가 받쳐 준다.
    query = query.or(`question.ilike.%${keyword}%,answer.ilike.%${keyword}%`);
  }
  if (category) {
    query = query.eq("category", category);
  }
  if (applicationId) {
    query = query.eq("application_id", applicationId);
  }

  const { data: essayData } = await query;
  const essays = (essayData ?? []) as Essay[];

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
    {
      name: "state",
      label: "상태",
      type: "select",
      options: ["초안", "최종"],
    },
    {
      name: "answer",
      label: "답변",
      type: "textarea",
      placeholder: "작성한 내용을 붙여넣으세요.",
    },
  ];

  const inputClass =
    "rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand-500";

  return (
    <PageShell
      title="라이브러리"
      description="써 둔 자소서를 검색하고 재활용합니다."
    >
      {/* ---------------- 검색 ---------------- */}
      <form method="get" className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="문항이나 답변에서 검색"
            className={`flex-1 ${inputClass}`}
          />
          <select
            name="category"
            defaultValue={category}
            className={inputClass}
            aria-label="문항 유형"
          >
            <option value="">유형 전체</option>
            {ESSAY_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            name="app"
            defaultValue={applicationId}
            className={inputClass}
            aria-label="기업"
          >
            <option value="">기업 전체</option>
            {applications.map((item) => (
              <option key={item.id} value={item.id}>
                {[item.company, item.season].filter(Boolean).join(" · ")}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            검색
          </button>
        </div>
      </form>

      <p className="-mt-2 text-sm text-ink-500">
        {keyword || category || applicationId
          ? `검색 결과 ${essays.length}건`
          : `전체 ${essays.length}건`}
      </p>

      {/* ---------------- 목록 ---------------- */}
      {essays.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-surface px-4 py-10 text-center text-sm text-ink-500">
          {keyword || category || applicationId
            ? "조건에 맞는 자소서가 없습니다."
            : "아직 저장한 자소서가 없습니다. 아래에서 추가해 보세요."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
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
                      essay.char_limit === null ? "" : String(essay.char_limit),
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
                    <p className="font-medium wrap-anywhere whitespace-pre-wrap">
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
                          {essay.application_id ? (
                            <span aria-hidden>·</span>
                          ) : null}
                          <span>{essay.category}</span>
                        </>
                      ) : null}
                      <span aria-hidden>·</span>
                      <span className={over ? "font-medium text-danger-600" : ""}>
                        {length}자
                        {essay.char_limit ? ` / ${essay.char_limit}자` : ""}
                        {over ? " 초과" : ""}
                      </span>
                    </p>

                    <div className="mt-2">
                      <EssayFinalToggle
                      action={toggleEssayFinal}
                        id={essay.id}
                        isFinal={essay.is_final}
                      />
                    </div>

                    {essay.answer ? (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm font-medium text-brand-600">
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
      )}

      <RecordForm action={addEssay} fields={fields} openLabel="자소서 추가" />
    </PageShell>
  );
}
