import {
  addEducation,
  addExperience,
  addSpec,
  importProfileJson,
  removeProfileRow,
  updateEducation,
  updateExperience,
  updateSpec,
} from "./actions";
import { DeleteRowButton } from "@/components/delete-row-button";
import { ProfileImport } from "@/components/profile-import";
import { EditableRow } from "@/components/editable-row";
import { PageShell } from "@/components/page-shell";
import { RecordForm, type Field } from "@/components/record-form";
import { dDayLabel, formatPeriod, urgencyOf } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";

type Education = {
  id: string;
  school: string;
  major: string | null;
  degree: string | null;
  start_date: string | null;
  end_date: string | null;
  gpa: string | null;
  key_courses: string | null;
};

type Spec = {
  id: string;
  name: string;
  category: string;
  status: string;
  score_or_grade: string | null;
  acquired_date: string | null;
  expiry_date: string | null;
  target_exam_id: string | null;
};

type Experience = {
  id: string;
  title: string;
  org: string | null;
  period_start: string | null;
  period_end: string | null;
  role: string | null;
  situation: string | null;
  action: string | null;
  result: string | null;
  tags: string[];
};

const EDUCATION_FIELDS: Field[] = [
  { name: "school", label: "학교", required: true, placeholder: "○○대학교" },
  { name: "major", label: "전공", placeholder: "경영학과" },
  {
    name: "degree",
    label: "학위",
    type: "select",
    options: ["학사", "전문학사", "석사", "박사", "고졸"],
  },
  { name: "gpa", label: "학점", placeholder: "3.8/4.5" },
  { name: "start_date", label: "입학", type: "date" },
  {
    name: "end_date",
    label: "졸업",
    type: "date",
    hint: "재학 중이면 비워 두세요",
  },
  {
    name: "key_courses",
    label: "주요 과목",
    type: "textarea",
    placeholder: "재무관리, 마케팅조사론",
  },
];

function buildSpecFields(
  exams: { id: string; label: string }[],
): Field[] {
  return [
  { name: "name", label: "이름", required: true, placeholder: "토익 / SQLD" },
  {
    name: "category",
    label: "분류",
    type: "select",
    options: ["자격증", "어학", "기타"],
  },
  {
    name: "status",
    label: "상태",
    type: "select",
    options: ["보유", "준비중", "목표"],
  },
  { name: "score_or_grade", label: "점수·등급", placeholder: "905 / 1급" },
  { name: "acquired_date", label: "취득일", type: "date" },
    {
      name: "expiry_date",
      label: "유효기간",
      type: "date",
      hint: "어학 점수는 보통 2년. 대시보드에서 D-day로 알려 줍니다",
    },
    {
      name: "target_exam_id",
      label: "목표 시험",
      type: "select",
      wide: true,
      choices: [
        { value: "", label: "선택 안 함" },
        ...exams.map((exam) => ({ value: exam.id, label: exam.label })),
      ],
      hint: "고르면 접수일과 시험일이 캘린더에 뜹니다",
    },
  ];
}

const EXPERIENCE_FIELDS: Field[] = [
  {
    name: "title",
    label: "제목",
    required: true,
    placeholder: "교내 창업동아리 팀장",
  },
  { name: "org", label: "소속", placeholder: "○○대 창업지원단" },
  { name: "period_start", label: "시작", type: "date" },
  { name: "period_end", label: "종료", type: "date", hint: "진행 중이면 비움" },
  { name: "role", label: "역할", placeholder: "기획 총괄" },
  {
    name: "tags",
    label: "태그",
    placeholder: "리더십, 협업, 문제해결",
    hint: "쉼표로 구분, 최대 10개",
  },
  {
    name: "situation",
    label: "상황 (S)",
    type: "textarea",
    placeholder: "어떤 문제나 목표가 있었나요?",
  },
  {
    name: "action",
    label: "행동 (A)",
    type: "textarea",
    placeholder: "그래서 무엇을 했나요?",
  },
  {
    name: "result",
    label: "결과 (R)",
    type: "textarea",
    placeholder: "숫자로 쓸 수 있으면 숫자로 쓰세요",
  },
];

function SectionTitle({ title, count }: { title: string; count: number }) {
  return (
    <h2 className="text-base font-bold">
      {title} <span className="text-sm font-normal text-ink-400">{count}</span>
    </h2>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-line bg-surface px-4 py-6 text-center text-sm text-ink-500">
      {text}
    </p>
  );
}

export default async function ProfilePage() {
  const supabase = await createClient();

  // RLS 덕분에 본인 것만 돌아온다.
  const [educationResult, specResult, experienceResult, examResult] =
    await Promise.all([
      supabase.from("education").select("*").order("start_date", { ascending: false }),
      supabase.from("user_specs").select("*").order("acquired_date", { ascending: false }),
      supabase.from("experiences").select("*").order("period_start", { ascending: false }),
      // 공용 테이블이라 모두가 읽을 수 있다.
      supabase
        .from("exams")
        .select("id, name, round, exam_date")
        .order("exam_date", { ascending: true, nullsFirst: false }),
    ]);

  const examOptions = (examResult.data ?? []).map((row) => {
    const r = row as {
      id: string;
      name: string;
      round: string | null;
      exam_date: string | null;
    };
    return {
      id: r.id,
      label: [r.name, r.round, r.exam_date].filter(Boolean).join(" · "),
    };
  });
  const examLabel = new Map(examOptions.map((e) => [e.id, e.label]));
  const SPEC_FIELDS = buildSpecFields(examOptions);

  const education = (educationResult.data ?? []) as Education[];
  const specs = (specResult.data ?? []) as Spec[];
  const experiences = (experienceResult.data ?? []) as Experience[];

  return (
    <PageShell
      title="프로필"
      description="자소서를 쓸 때 꺼내 쓸 재료를 모아 둡니다."
    >
      {education.length === 0 && experiences.length === 0 ? (
        <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-4">
          <p className="text-sm font-bold text-brand-700">
            기존 이력서가 있으신가요?
          </p>
          <p className="mt-1 mb-3 text-sm text-brand-700">
            한 줄씩 옮겨 적는 대신, 이력서를 통째로 넣어 학력과 경험을 한 번에
            채울 수 있습니다.
          </p>
          <ProfileImport action={importProfileJson} />
        </div>
      ) : null}

      {/* ---------------- 학력 ---------------- */}
      <section className="flex flex-col gap-3">
        <SectionTitle title="학력" count={education.length} />

        {education.length === 0 ? (
          <Empty text="아직 등록한 학력이 없습니다." />
        ) : (
          <ul className="flex flex-col gap-2">
            {education.map((row) => (
              <li key={row.id}>
                <EditableRow
                  action={updateEducation}
                  fields={EDUCATION_FIELDS}
                  defaults={row}
                  id={row.id}
                  title={row.school}
                  deleteSlot={
                    <DeleteRowButton
                      action={removeProfileRow}
                      table="education"
                      id={row.id}
                      label={row.school}
                    />
                  }
                >
                  <div className="min-w-0">
                  <p className="font-medium">
                    {row.school}
                    {row.major ? (
                      <span className="text-ink-500"> · {row.major}</span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-500">
                    {[
                      row.degree,
                      formatPeriod(row.start_date, row.end_date, "재학 중"),
                      row.gpa ? `학점 ${row.gpa}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {row.key_courses ? (
                    <p className="mt-2 text-sm text-ink-500">
                      {row.key_courses}
                    </p>
                  ) : null}
                  </div>
                </EditableRow>
              </li>
            ))}
          </ul>
        )}

        <RecordForm
          action={addEducation}
          fields={EDUCATION_FIELDS}
          openLabel="학력 추가"
        />
      </section>

      {/* ---------------- 자격·어학 ---------------- */}
      <section className="flex flex-col gap-3">
        <SectionTitle title="자격증 · 어학" count={specs.length} />

        {specs.length === 0 ? (
          <Empty text="아직 등록한 자격증이나 어학 점수가 없습니다." />
        ) : (
          <ul className="flex flex-col gap-2">
            {specs.map((row) => {
              const urgency = row.expiry_date ? urgencyOf(row.expiry_date) : null;
              return (
                <li key={row.id}>
                  <EditableRow
                    action={updateSpec}
                    fields={SPEC_FIELDS}
                    defaults={row}
                    id={row.id}
                    title={row.name}
                    deleteSlot={
                      <DeleteRowButton
                        action={removeProfileRow}
                        table="user_specs"
                        id={row.id}
                        label={row.name}
                      />
                    }
                  >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {row.name}
                      {row.score_or_grade ? (
                        <span className="text-ink-500">
                          {" "}
                          · {row.score_or_grade}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-ink-500">
                      <span>{row.category}</span>
                      <span aria-hidden>·</span>
                      <span>{row.status}</span>
                      {row.target_exam_id ? (
                        <>
                          <span aria-hidden>·</span>
                          <span className="text-brand-600">
                            목표: {examLabel.get(row.target_exam_id) ?? "삭제된 시험"}
                          </span>
                        </>
                      ) : null}
                      {row.expiry_date ? (
                        <>
                          <span aria-hidden>·</span>
                          <span
                            className={
                              urgency === "expired"
                                ? "font-medium text-ink-500"
                                : urgency === "soon"
                                  ? "font-medium text-danger-600"
                                  : "text-ink-500"
                            }
                          >
                            {urgency === "expired"
                              ? `${row.expiry_date} 만료됨`
                              : `${row.expiry_date} 만료 (${dDayLabel(row.expiry_date)})`}
                          </span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  </EditableRow>
                </li>
              );
            })}
          </ul>
        )}

        <RecordForm
          action={addSpec}
          fields={SPEC_FIELDS}
          openLabel="자격증 · 어학 추가"
        />
      </section>

      {/* ---------------- 경험 뱅크 ---------------- */}
      <section className="flex flex-col gap-3">
        <SectionTitle title="경험 뱅크" count={experiences.length} />
        <p className="-mt-2 text-sm text-ink-500">
          상황(S) · 행동(A) · 결과(R)로 나눠 적어 두면 자소서 쓸 때 그대로 꺼내
          쓸 수 있습니다.
        </p>

        {experiences.length === 0 ? (
          <Empty text="아직 등록한 경험이 없습니다." />
        ) : (
          <ul className="flex flex-col gap-2">
            {experiences.map((row) => (
              <li key={row.id}>
                <EditableRow
                  action={updateExperience}
                  fields={EXPERIENCE_FIELDS}
                  defaults={{ ...row, tags: row.tags.join(", ") }}
                  id={row.id}
                  title={row.title}
                  deleteSlot={
                    <DeleteRowButton
                      action={removeProfileRow}
                      table="experiences"
                      id={row.id}
                      label={row.title}
                    />
                  }
                >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{row.title}</p>
                  <p className="mt-0.5 text-sm text-ink-500">
                    {[
                      row.org,
                      row.role,
                      formatPeriod(row.period_start, row.period_end),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>

                  {row.tags.length > 0 ? (
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {row.tags.map((tag) => (
                        <li
                          key={tag}
                          className="rounded-full bg-muted-100 px-2 py-0.5 text-xs text-ink-500"
                        >
                          {tag}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <dl className="mt-3 flex flex-col gap-2 text-sm">
                    {(
                      [
                        ["상황", row.situation],
                        ["행동", row.action],
                        ["결과", row.result],
                      ] as const
                    )
                      .filter(([, text]) => Boolean(text))
                      .map(([label, text]) => (
                        <div key={label} className="flex gap-2">
                          <dt className="w-8 shrink-0 text-xs font-medium text-ink-400">
                            {label}
                          </dt>
                          <dd className="min-w-0 wrap-anywhere whitespace-pre-wrap text-ink-700">
                            {text}
                          </dd>
                        </div>
                      ))}
                  </dl>
                </div>
                </EditableRow>
              </li>
            ))}
          </ul>
        )}

        <RecordForm
          action={addExperience}
          fields={EXPERIENCE_FIELDS}
          openLabel="경험 추가"
        />
      </section>

      {education.length > 0 || experiences.length > 0 ? (
        <ProfileImport action={importProfileJson} />
      ) : null}
    </PageShell>
  );
}
