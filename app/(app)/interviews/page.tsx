import Link from "next/link";

import { addInterview, removeInterview, updateInterview } from "./actions";
import { DeleteRowButton } from "@/components/delete-row-button";
import { EditableRow } from "@/components/editable-row";
import { PageShell } from "@/components/page-shell";
import { RecordForm, type Field } from "@/components/record-form";
import { EmptyState, Tag } from "@/components/ui/primitives";
import {
  INTERVIEW_FORMATS,
  INTERVIEW_RESULTS,
  resultTone,
} from "@/lib/interview";
import { createOwnClient } from "@/lib/supabase/server";

type InterviewRow = {
  id: string;
  application_id: string | null;
  stage: string;
  type: string | null;
  date: string | null;
  format: string;
  interviewer_count: number | null;
  atmosphere: string | null;
  overall_review: string | null;
  result: string;
};

export default async function InterviewsPage() {
  const { supabase, userId } = await createOwnClient();

  const [interviewResult, appResult, questionResult] = await Promise.all([
    supabase
      .from("interviews")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false, nullsFirst: false }),
    supabase
      .from("applications")
      .select("id, company, season")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("interview_questions")
      .select("interview_id")
      .eq("user_id", userId),
  ]);

  const interviews = (interviewResult.data ?? []) as InterviewRow[];

  const companyById = new Map(
    (appResult.data ?? []).map((row) => {
      const r = row as { id: string; company: string; season: string | null };
      return [r.id, [r.company, r.season].filter(Boolean).join(" · ")];
    }),
  );

  const questionCount = new Map<string, number>();
  for (const row of questionResult.data ?? []) {
    const key = (row as { interview_id: string }).interview_id;
    questionCount.set(key, (questionCount.get(key) ?? 0) + 1);
  }

  const fields: Field[] = [
    {
      name: "application_id",
      label: "기업",
      type: "select",
      choices: [
        { value: "", label: "선택 안 함" },
        ...(appResult.data ?? []).map((row) => {
          const r = row as { id: string; company: string; season: string | null };
          return {
            value: r.id,
            label: [r.company, r.season].filter(Boolean).join(" · "),
          };
        }),
      ],
    },
    { name: "stage", label: "차수", required: true, placeholder: "1차" },
    { name: "type", label: "유형", placeholder: "실무 / 임원 / PT" },
    { name: "date", label: "면접일", type: "date" },
    {
      name: "format",
      label: "방식",
      type: "select",
      options: [...INTERVIEW_FORMATS],
    },
    {
      name: "interviewer_count",
      label: "면접관 수",
      type: "number",
      placeholder: "3",
    },
    {
      name: "result",
      label: "결과",
      type: "select",
      options: [...INTERVIEW_RESULTS],
    },
    { name: "atmosphere", label: "분위기", placeholder: "편안했음 / 압박" },
    { name: "overall_review", label: "총평", type: "textarea" },
  ];

  return (
    <PageShell
      title="면접 복기"
      description={`전체 ${interviews.length}회차`}
    >
      {interviews.length === 0 ? (
        <EmptyState text="아직 기록한 면접이 없습니다. 면접이 끝나면 바로 회차를 만들고 질문부터 쏟아 넣으세요." />
      ) : (
        <ul className="flex flex-col gap-2">
          {interviews.map((item) => {
            const count = questionCount.get(item.id) ?? 0;
            return (
              <li key={item.id}>
                <EditableRow
                  action={updateInterview}
                  fields={fields}
                  defaults={{
                    application_id: item.application_id,
                    stage: item.stage,
                    type: item.type,
                    date: item.date,
                    format: item.format,
                    interviewer_count:
                      item.interviewer_count === null
                        ? ""
                        : String(item.interviewer_count),
                    result: item.result,
                    atmosphere: item.atmosphere,
                    overall_review: item.overall_review,
                  }}
                  id={item.id}
                  title={`${item.stage} 면접`}
                  deleteSlot={
                    <DeleteRowButton
                      action={removeInterview}
                      id={item.id}
                      label={`${item.stage} 면접`}
                    />
                  }
                >
                  <Link href={`/interviews/${item.id}`} className="block">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="min-w-0 truncate font-medium">
                        {item.application_id
                          ? (companyById.get(item.application_id) ??
                            "삭제된 기업")
                          : "기업 미지정"}
                      </p>
                      <Tag tone={resultTone(item.result)}>{item.result}</Tag>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-ink-500">
                      {[
                        item.stage,
                        item.type,
                        item.format,
                        item.date,
                        item.interviewer_count
                          ? `면접관 ${item.interviewer_count}명`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="mt-1 text-xs text-brand-600">
                      질문 {count}개 · 자세히 보기
                    </p>
                  </Link>
                </EditableRow>
              </li>
            );
          })}
        </ul>
      )}

      <RecordForm
        action={addInterview}
        fields={fields}
        openLabel="면접 회차 추가"
      />
    </PageShell>
  );
}
