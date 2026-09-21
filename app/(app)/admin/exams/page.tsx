import { notFound, redirect } from "next/navigation";

import { addExam, removeExam, updateExam } from "./actions";
import { DeleteRowButton } from "@/components/delete-row-button";
import { EditableRow } from "@/components/editable-row";
import { PageShell } from "@/components/page-shell";
import { RecordForm, type Field } from "@/components/record-form";
import { Tag } from "@/components/ui/primitives";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { createAdminClient, isAdminUsername } from "@/lib/supabase/admin";

type ExamRow = {
  id: string;
  name: string;
  category: string;
  round: string | null;
  reg_start: string | null;
  reg_end: string | null;
  exam_date: string | null;
  result_date: string | null;
  memo: string | null;
};

const FIELDS: Field[] = [
  { name: "name", label: "시험 이름", required: true, placeholder: "SQLD" },
  {
    name: "category",
    label: "분류",
    type: "select",
    options: ["자격증", "어학", "기타"],
  },
  { name: "round", label: "회차", placeholder: "2026년 제1회" },
  { name: "reg_start", label: "접수 시작", type: "date" },
  { name: "reg_end", label: "접수 마감", type: "date" },
  { name: "exam_date", label: "시험일", type: "date" },
  { name: "result_date", label: "발표일", type: "date" },
  { name: "memo", label: "메모", type: "textarea" },
];

export default async function AdminExamsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!isAdminUsername(profile.username)) notFound();

  const admin = createAdminClient();
  const { data } = await admin
    .from("exams")
    .select("*")
    .order("exam_date", { ascending: true, nullsFirst: false });

  const items = (data ?? []) as ExamRow[];

  return (
    <PageShell
      title="시험 일정"
      description={`전체 ${items.length}건 · 모든 사용자가 함께 봅니다`}
    >
      <p className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-500">
        SQLD·토익·오픽처럼 공개 API가 없는 시험은 운영자가 직접 넣습니다
        (CLAUDE.md 8장). 사용자는 프로필의 자격·어학 항목에서 이 중 하나를
        목표로 고를 수 있고, 고르면 접수일과 시험일이 그 사람 캘린더에 뜹니다.
      </p>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-surface px-4 py-8 text-center text-sm text-ink-500">
          아직 넣은 시험 일정이 없습니다.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <EditableRow
                action={updateExam}
                fields={FIELDS}
                defaults={{
                  name: item.name,
                  category: item.category,
                  round: item.round,
                  reg_start: item.reg_start,
                  reg_end: item.reg_end,
                  exam_date: item.exam_date,
                  result_date: item.result_date,
                  memo: item.memo,
                }}
                id={item.id}
                title={item.name}
                deleteSlot={
                  <DeleteRowButton
                    action={removeExam}
                    id={item.id}
                    label={`${item.name} ${item.round ?? ""}`}
                  />
                }
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="min-w-0 truncate font-medium">{item.name}</p>
                    <Tag>{item.category}</Tag>
                    {item.round ? <Tag>{item.round}</Tag> : null}
                  </div>
                  <p className="mt-0.5 text-sm text-ink-500">
                    {[
                      item.reg_start || item.reg_end
                        ? `접수 ${item.reg_start ?? "?"} ~ ${item.reg_end ?? "?"}`
                        : null,
                      item.exam_date ? `시험 ${item.exam_date}` : null,
                      item.result_date ? `발표 ${item.result_date}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "날짜 미정"}
                  </p>
                  {item.memo ? (
                    <p className="mt-1 text-sm text-ink-500">{item.memo}</p>
                  ) : null}
                </div>
              </EditableRow>
            </li>
          ))}
        </ul>
      )}

      <RecordForm action={addExam} fields={FIELDS} openLabel="시험 일정 추가" />
    </PageShell>
  );
}
