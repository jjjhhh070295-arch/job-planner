"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, Quote, Sparkles, Trash2 } from "lucide-react";

import { saveParsedPosting } from "./actions";
import {
  Tag,
  btnGhost,
  btnIcon,
  btnPrimary,
  inputClass,
} from "@/components/ui/primitives";
import { STATUSES } from "@/lib/application-status";
import type { ParseChecks, ParsedPosting } from "@/lib/posting-parser";

type EssayDraft = {
  question: string;
  charLimit: string;
  grounded: boolean;
  quote: string;
};

type Draft = {
  company: string;
  role: string;
  season: string;
  status: string;
  deadline: string;
  postingUrl: string;
  deadlineNote: string;
  essays: EssayDraft[];
};

/** "2026-10-16T17:00" -> "2026-10-16" (날짜 칸에 넣을 값) */
function toDateOnly(value: string | null): string {
  if (!value) return "";
  const match = value.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "";
}

function Field({
  label,
  children,
  check,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  check?: { grounded: boolean; quote: string | null };
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center gap-2 text-sm font-medium text-ink-700">
        {label}
        {check && check.quote && !check.grounded ? (
          <Tag tone="danger">확인 필요</Tag>
        ) : null}
      </span>
      {children}
      {hint ? <span className="text-xs text-ink-400">{hint}</span> : null}
      {check?.quote ? (
        <span
          className={
            "flex gap-1.5 rounded-lg px-2 py-1.5 text-xs " +
            (check.grounded
              ? "bg-muted-100 text-muted-600"
              : "bg-danger-50 text-danger-700")
          }
        >
          <Quote className="mt-0.5 size-3 shrink-0" aria-hidden />
          <span className="wrap-anywhere">{check.quote}</span>
        </span>
      ) : null}
    </label>
  );
}

export function ParseClient({ usedToday, limit }: { usedToday: number; limit: number }) {
  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checks, setChecks] = useState<ParseChecks | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [requirements, setRequirements] = useState<string>("");

  const [saveState, saveAction, saving] = useActionState(
    saveParsedPosting,
    null,
  );

  async function handleParse() {
    setError(null);
    setParsing(true);

    const response = await fetch("/api/ai/parse-posting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    const data = await response.json().catch(() => null);
    setParsing(false);

    if (!response.ok) {
      setError(data?.message ?? "공고를 읽지 못했습니다.");
      return;
    }

    const parsed = data.parsed as ParsedPosting;
    const nextChecks = data.checks as ParseChecks;

    setChecks(nextChecks);
    setRequirements(
      JSON.stringify({
        language: (parsed.language_requirements ?? []).map((l) => ({
          name: l.name,
          requirement: l.requirement,
        })),
        other: parsed.other_requirements ?? [],
        deadline_note: parsed.deadline?.note ?? null,
      }),
    );
    setDraft({
      company: parsed.company?.value ?? "",
      role: parsed.role?.value ?? "",
      season: parsed.season?.value ?? "",
      status: "작성 중",
      deadline: toDateOnly(parsed.deadline?.value ?? null),
      postingUrl: "",
      deadlineNote: parsed.deadline?.note ?? "",
      essays: (parsed.essay_questions ?? []).map((q, index) => ({
        question: q.question,
        charLimit: q.char_limit === null ? "" : String(q.char_limit),
        grounded: nextChecks.essay_questions[index]?.grounded ?? true,
        quote: q.quote,
      })),
    });
  }

  function patch(next: Partial<Draft>) {
    setDraft((prev) => (prev ? { ...prev, ...next } : prev));
  }

  function patchEssay(index: number, next: Partial<EssayDraft>) {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            essays: prev.essays.map((e, i) =>
              i === index ? { ...e, ...next } : e,
            ),
          }
        : prev,
    );
  }

  function removeEssay(index: number) {
    setDraft((prev) =>
      prev ? { ...prev, essays: prev.essays.filter((_, i) => i !== index) } : prev,
    );
  }

  const remaining = Math.max(0, limit - usedToday);

  return (
    <div className="flex flex-col gap-4">
      {/* ---------------- 1단계: 붙여넣기 ---------------- */}
      <section className="rounded-xl border border-line bg-surface p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-base font-bold">공고 붙여넣기</h2>
          <span className="shrink-0 text-xs text-ink-400">
            오늘 {usedToday}/{limit}회 사용
          </span>
        </div>

        <p className="mb-3 text-sm text-ink-500">
          채용공고 페이지의 글을 통째로 복사해서 붙여넣으세요. 기업·직무·마감일·자소서
          문항·어학 요건을 뽑아냅니다.
        </p>

        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={10}
          placeholder="채용공고 내용을 여기에 붙여넣으세요."
          className={inputClass}
        />

        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-xs text-ink-400">
            {text.length.toLocaleString()}자
          </span>
          <button
            type="button"
            onClick={handleParse}
            disabled={parsing || text.trim().length < 30 || remaining === 0}
            className={btnPrimary}
          >
            <Sparkles className="size-4" aria-hidden />
            {parsing ? "읽는 중..." : "공고 읽기"}
          </button>
        </div>

        {remaining === 0 ? (
          <p className="mt-3 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
            오늘 AI 사용 횟수를 모두 썼습니다. 내일 다시 시도해 주세요.
          </p>
        ) : null}

        {error ? (
          <p className="mt-3 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
            {error}
          </p>
        ) : null}
      </section>

      {/* ---------------- 2단계: 확인하고 고치기 ---------------- */}
      {draft ? (
        <form action={saveAction} className="flex flex-col gap-4">
          <input type="hidden" name="posting_text" value={text} />
          <input
            type="hidden"
            name="requirements_json"
            value={requirements}
          />
          <input
            type="hidden"
            name="essays_json"
            value={JSON.stringify(
              draft.essays.map((e) => ({
                question: e.question,
                char_limit: e.charLimit ? Number(e.charLimit) : null,
              })),
            )}
          />

          <section className="rounded-xl border border-line bg-surface p-4">
            <h2 className="text-base font-bold">확인하고 고치기</h2>
            <p className="mt-1 text-sm text-ink-500">
              AI가 뽑은 내용입니다. <strong>그대로 저장되지 않습니다.</strong>{" "}
              틀린 곳을 고친 뒤 저장하세요.
            </p>

            {checks && checks.ungroundedCount > 0 ? (
              <p className="mt-3 flex gap-2 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  {checks.ungroundedCount}개 항목은 근거가 된 문장을 공고에서
                  찾지 못했습니다. 지어냈을 수 있으니 꼭 확인하세요.
                </span>
              </p>
            ) : null}

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="기업" check={checks?.company}>
                <input
                  name="company"
                  required
                  value={draft.company}
                  onChange={(e) => patch({ company: e.target.value })}
                  className={inputClass + " h-11"}
                />
              </Field>

              <Field label="직무" check={checks?.role}>
                <input
                  name="role"
                  value={draft.role}
                  onChange={(e) => patch({ role: e.target.value })}
                  className={inputClass + " h-11"}
                />
              </Field>

              <Field label="시즌" check={checks?.season}>
                <input
                  name="season"
                  value={draft.season}
                  onChange={(e) => patch({ season: e.target.value })}
                  className={inputClass + " h-11"}
                />
              </Field>

              <Field
                label="마감"
                check={checks?.deadline}
                hint={
                  draft.deadlineNote
                    ? `공고에는 "${draft.deadlineNote}" 로 적혀 있습니다`
                    : undefined
                }
              >
                <input
                  type="date"
                  name="deadline"
                  value={draft.deadline}
                  onChange={(e) => patch({ deadline: e.target.value })}
                  className={inputClass + " h-11"}
                />
              </Field>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink-700">
                  전형 단계
                </span>
                <select
                  name="status"
                  value={draft.status}
                  onChange={(e) => patch({ status: e.target.value })}
                  className={inputClass + " h-11"}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink-700">
                  공고 링크
                </span>
                <input
                  name="posting_url"
                  value={draft.postingUrl}
                  onChange={(e) => patch({ postingUrl: e.target.value })}
                  placeholder="https://..."
                  className={inputClass + " h-11"}
                />
              </label>
            </div>
          </section>

          {/* 자소서 문항 */}
          <section className="rounded-xl border border-line bg-surface p-4">
            <h2 className="text-base font-bold">
              자소서 문항{" "}
              <span className="text-sm font-normal text-ink-400">
                {draft.essays.length}
              </span>
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              저장하면 라이브러리에 빈 자소서로 들어갑니다.
            </p>

            {draft.essays.length === 0 ? (
              <p className="mt-3 text-sm text-ink-400">
                공고에서 자소서 문항을 찾지 못했습니다.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {draft.essays.map((essay, index) => (
                  <li
                    key={index}
                    className="rounded-lg border border-line p-3"
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex items-center gap-2">
                          <span className="text-xs font-medium text-ink-500">
                            {index + 1}번 문항
                          </span>
                          {!essay.grounded ? (
                            <Tag tone="danger">확인 필요</Tag>
                          ) : null}
                        </div>
                        <textarea
                          rows={2}
                          value={essay.question}
                          onChange={(e) =>
                            patchEssay(index, { question: e.target.value })
                          }
                          className={inputClass}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeEssay(index)}
                        aria-label={`${index + 1}번 문항 빼기`}
                        className={btnIcon + " hover:bg-danger-50 hover:text-danger-600"}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>

                    <label className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-ink-500">글자 수</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={essay.charLimit}
                        onChange={(e) =>
                          patchEssay(index, { charLimit: e.target.value })
                        }
                        placeholder="제한 없음"
                        className={inputClass + " h-11 w-32"}
                      />
                    </label>

                    {essay.quote ? (
                      <p
                        className={
                          "mt-2 flex gap-1.5 rounded-lg px-2 py-1.5 text-xs " +
                          (essay.grounded
                            ? "bg-muted-100 text-muted-600"
                            : "bg-danger-50 text-danger-700")
                        }
                      >
                        <Quote className="mt-0.5 size-3 shrink-0" aria-hidden />
                        <span className="wrap-anywhere">{essay.quote}</span>
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {saveState && !saveState.ok ? (
            <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
              {saveState.message}
            </p>
          ) : null}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className={btnPrimary + " flex-1 md:flex-none"}
            >
              {saving ? "저장 중..." : "지원 현황에 저장"}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(null);
                setChecks(null);
              }}
              className={btnGhost}
            >
              다시 읽기
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
