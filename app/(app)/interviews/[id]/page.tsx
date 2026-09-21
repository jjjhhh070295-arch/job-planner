import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, CornerDownRight } from "lucide-react";

import { removeQuestion, updateQuestion } from "../actions";
import { QuickRecord } from "./quick-record";
import { DeleteRowButton } from "@/components/delete-row-button";
import { EditableRow } from "@/components/editable-row";
import { PageShell } from "@/components/page-shell";
import { type Field } from "@/components/form-fields";
import { Tag } from "@/components/ui/primitives";
import { QUESTION_CATEGORIES, resultTone } from "@/lib/interview";
import { createClient } from "@/lib/supabase/server";

type QuestionRow = {
  id: string;
  parent_id: string | null;
  question: string;
  my_answer: string | null;
  improvement: string | null;
  category: string | null;
  position: number;
};

export default async function InterviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // RLS 덕분에 남의 회차는 아예 조회되지 않는다.
  const { data: interview } = await supabase
    .from("interviews")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!interview) notFound();

  const [questionResult, appResult] = await Promise.all([
    supabase
      .from("interview_questions")
      .select("*")
      .eq("interview_id", id)
      .order("position"),
    interview.application_id
      ? supabase
          .from("applications")
          .select("company, season")
          .eq("id", interview.application_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const questions = (questionResult.data ?? []) as QuestionRow[];
  const roots = questions.filter((q) => q.parent_id === null);
  const childrenOf = (parentId: string) =>
    questions.filter((q) => q.parent_id === parentId);

  const last = questions[questions.length - 1] ?? null;

  const company = appResult.data
    ? [
        (appResult.data as { company: string }).company,
        (appResult.data as { season: string | null }).season,
      ]
        .filter(Boolean)
        .join(" · ")
    : "기업 미지정";

  const questionFields: Field[] = [
    { name: "question", label: "질문", type: "textarea", required: true },
    {
      name: "category",
      label: "유형",
      type: "select",
      choices: [
        { value: "", label: "선택 안 함" },
        ...QUESTION_CATEGORIES.map((c) => ({ value: c, label: c })),
      ],
    },
    {
      name: "my_answer",
      label: "내가 한 답변",
      type: "textarea",
      placeholder: "기억나는 대로 적어 두면 다음에 도움이 됩니다.",
    },
    {
      name: "improvement",
      label: "이렇게 답했어야 했다",
      type: "textarea",
      placeholder: "보완점",
    },
  ];

  function QuestionItem({
    item,
    index,
    isChild = false,
  }: {
    item: QuestionRow;
    index: number;
    isChild?: boolean;
  }) {
    return (
      <EditableRow
        action={updateQuestion}
        fields={questionFields}
        defaults={{
          question: item.question,
          category: item.category,
          my_answer: item.my_answer,
          improvement: item.improvement,
        }}
        id={item.id}
        title={`${index}번 질문`}
        className="rounded-xl border border-line bg-surface p-4"
        deleteSlot={
          <DeleteRowButton
            action={removeQuestion}
            id={item.id}
            label={item.question.slice(0, 20)}
          />
        }
      >
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            {isChild ? (
              <span className="inline-flex items-center gap-1 text-xs text-ink-400">
                <CornerDownRight className="size-3.5" aria-hidden />
                꼬리질문
              </span>
            ) : (
              <span className="text-xs font-medium text-ink-400">
                Q{index}
              </span>
            )}
            {item.category ? <Tag>{item.category}</Tag> : null}
          </div>

          <p className="wrap-anywhere whitespace-pre-wrap font-medium">
            {item.question}
          </p>

          {item.my_answer ? (
            <div className="mt-2">
              <p className="text-xs font-medium text-ink-400">내 답변</p>
              <p className="wrap-anywhere whitespace-pre-wrap text-sm text-ink-700">
                {item.my_answer}
              </p>
            </div>
          ) : null}

          {item.improvement ? (
            <div className="mt-2 rounded-lg bg-brand-50 px-3 py-2">
              <p className="text-xs font-medium text-brand-700">보완점</p>
              <p className="wrap-anywhere whitespace-pre-wrap text-sm text-brand-700">
                {item.improvement}
              </p>
            </div>
          ) : null}

          {!item.my_answer && !item.improvement ? (
            <p className="mt-2 text-xs text-ink-400">
              답변과 보완점은 아직 비어 있습니다. 연필을 눌러 채워 보세요.
            </p>
          ) : null}
        </div>
      </EditableRow>
    );
  }

  return (
    <PageShell
      title={`${interview.stage} 면접`}
      description={company}
      actions={
        <Link
          href="/interviews"
          className="tap inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink-700 hover:bg-muted-100"
        >
          <ChevronLeft className="size-4" aria-hidden />
          목록
        </Link>
      }
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Tag tone={resultTone(interview.result)}>{interview.result}</Tag>
        {[interview.type, interview.format, interview.date]
          .filter(Boolean)
          .map((text) => (
            <Tag key={String(text)}>{String(text)}</Tag>
          ))}
        {interview.interviewer_count ? (
          <Tag>면접관 {interview.interviewer_count}명</Tag>
        ) : null}
      </div>

      {interview.atmosphere || interview.overall_review ? (
        <div className="rounded-xl border border-line bg-surface p-4">
          {interview.atmosphere ? (
            <p className="text-sm text-ink-700">
              <span className="font-medium">분위기 </span>
              {interview.atmosphere}
            </p>
          ) : null}
          {interview.overall_review ? (
            <p className="mt-2 wrap-anywhere whitespace-pre-wrap text-sm text-ink-700">
              {interview.overall_review}
            </p>
          ) : null}
        </div>
      ) : null}

      <QuickRecord
        interviewId={id}
        lastQuestionId={last?.id ?? null}
        lastQuestionText={last?.question.slice(0, 40) ?? null}
      />

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-bold">
          받은 질문{" "}
          <span className="text-sm font-normal text-ink-400">
            {questions.length}
          </span>
        </h2>

        {questions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-surface px-4 py-8 text-center text-sm text-ink-500">
            아직 기록한 질문이 없습니다. 위에서 바로 넣어 보세요.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {roots.map((root, index) => (
              <li key={root.id} className="flex flex-col gap-2">
                <QuestionItem item={root} index={index + 1} />
                {childrenOf(root.id).map((child) => (
                  <div key={child.id} className="pl-4 md:pl-8">
                    <QuestionItem item={child} index={index + 1} isChild />
                  </div>
                ))}
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
