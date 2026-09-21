"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Check, ClipboardCopy, Wand2 } from "lucide-react";

import { FormSheet } from "@/components/ui/form-sheet";
import {
  btnGhost,
  btnPrimary,
  inputClass,
} from "@/components/ui/primitives";
import { buildEssayPrompt } from "@/lib/essay-prompt";
import type { FormState } from "@/lib/form-state";

export type ExperienceOption = {
  id: string;
  title: string;
  org: string | null;
  role: string | null;
  period: string;
  situation: string | null;
  action: string | null;
  result: string | null;
  tags: string[];
};

export type ReferenceOption = {
  id: string;
  question: string;
  answer: string;
};

/**
 * 자소서 초안용 프롬프트를 만들어 클립보드에 넣는다.
 * 경험과 자소서 원문은 우리 서버에서 AI 로 보내지 않는다 (CLAUDE.md 3장 5번).
 * 사용자가 자기가 쓰는 AI 채팅에 직접 붙여넣는 방식이다.
 */
export function PromptBuilder({
  essayId,
  question,
  charLimit,
  company,
  role,
  experiences,
  references,
  saveDraft,
}: {
  essayId: string;
  question: string;
  charLimit: number | null;
  company: string | null;
  role: string | null;
  experiences: ExperienceOption[];
  references: ReferenceOption[];
  saveDraft: (prev: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [open, setOpen] = useState(false);
  const [pickedExp, setPickedExp] = useState<string[]>([]);
  const [pickedRef, setPickedRef] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [state, action, pending] = useActionState(saveDraft, null);

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  const prompt = useMemo(
    () =>
      buildEssayPrompt({
        question,
        charLimit,
        company,
        role,
        experiences: experiences
          .filter((e) => pickedExp.includes(e.id))
          .map((e) => ({
            title: e.title,
            org: e.org,
            role: e.role,
            period: e.period,
            situation: e.situation,
            action: e.action,
            result: e.result,
            tags: e.tags,
          })),
        references: references
          .filter((r) => pickedRef.includes(r.id))
          .map((r) => ({ question: r.question, answer: r.answer })),
      }),
    [question, charLimit, company, role, experiences, references, pickedExp, pickedRef],
  );

  function toggle(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={btnGhost + " px-3 text-xs"}
      >
        <Wand2 className="size-3.5" aria-hidden />
        프롬프트 만들기
      </button>

      <FormSheet
        open={open}
        onClose={() => setOpen(false)}
        title="자소서 프롬프트 만들기"
      >
        <div className="flex flex-col gap-4">
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
            여기서 만든 프롬프트를 복사해서 <strong>직접 쓰는 AI 채팅</strong>에
            붙여넣으세요. 경험과 자소서 내용은 이 앱이 AI로 보내지 않습니다.
          </p>

          {/* 경험 고르기 */}
          <div>
            <p className="mb-2 text-sm font-medium text-ink-700">
              넣을 경험 고르기{" "}
              <span className="text-ink-400">({pickedExp.length}개 선택)</span>
            </p>
            {experiences.length === 0 ? (
              <p className="text-sm text-ink-400">
                프로필에 경험을 먼저 등록해 주세요.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {experiences.map((exp) => (
                  <li key={exp.id}>
                    <label className="flex items-start gap-2.5 rounded-lg border border-line p-2.5">
                      <input
                        type="checkbox"
                        checked={pickedExp.includes(exp.id)}
                        onChange={() =>
                          setPickedExp((list) => toggle(list, exp.id))
                        }
                        className="mt-0.5 size-5 shrink-0 accent-brand-600"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {exp.title}
                        </span>
                        <span className="block truncate text-xs text-ink-400">
                          {[exp.org, exp.role, exp.period]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 참고 자소서 고르기 */}
          {references.length > 0 ? (
            <div>
              <p className="mb-2 text-sm font-medium text-ink-700">
                문체 참고용 자소서{" "}
                <span className="text-ink-400">
                  ({pickedRef.length}개 선택)
                </span>
              </p>
              <ul className="flex flex-col gap-1.5">
                {references.map((ref) => (
                  <li key={ref.id}>
                    <label className="flex items-start gap-2.5 rounded-lg border border-line p-2.5">
                      <input
                        type="checkbox"
                        checked={pickedRef.includes(ref.id)}
                        onChange={() =>
                          setPickedRef((list) => toggle(list, ref.id))
                        }
                        className="mt-0.5 size-5 shrink-0 accent-brand-600"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {ref.question}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* 만들어진 프롬프트 */}
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-ink-700">만들어진 프롬프트</p>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(prompt);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1800);
                  } catch {
                    // 클립보드를 막아 둔 브라우저에서는 아래 칸에서 직접 긁어 복사한다.
                  }
                }}
                className={btnPrimary + " px-3 text-xs"}
              >
                {copied ? (
                  <Check className="size-3.5" aria-hidden />
                ) : (
                  <ClipboardCopy className="size-3.5" aria-hidden />
                )}
                {copied ? "복사됨" : "복사"}
              </button>
            </div>
            <textarea
              readOnly
              value={prompt}
              rows={8}
              className={inputClass + " font-mono text-xs"}
            />
          </div>

          {/* 받은 초안 붙여넣기 */}
          <form action={action} className="border-t border-line pt-4">
            <input type="hidden" name="id" value={essayId} />
            <input
              type="hidden"
              name="source_experience_ids"
              value={pickedExp.join(",")}
            />

            <p className="mb-2 text-sm font-medium text-ink-700">
              AI가 써 준 초안 붙여넣기
            </p>
            <textarea
              name="draft"
              rows={6}
              placeholder="AI 채팅에서 받은 답변을 여기에 붙여넣으면 초안으로 저장됩니다."
              className={inputClass}
            />
            <p className="mt-1 text-xs text-ink-400">
              초안으로만 저장되고, 넣은 경험이 출처로 함께 기록됩니다.
            </p>

            {state && !state.ok ? (
              <p className="mt-2 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
                {state.message}
              </p>
            ) : null}

            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                disabled={pending}
                className={btnPrimary + " flex-1 md:flex-none"}
              >
                {pending ? "저장 중..." : "초안으로 저장"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={btnGhost}
              >
                닫기
              </button>
            </div>
          </form>
        </div>
      </FormSheet>
    </>
  );
}
