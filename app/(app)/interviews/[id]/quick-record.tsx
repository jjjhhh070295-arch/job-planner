"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CornerDownRight, Plus } from "lucide-react";

import { addQuestion } from "../actions";
import { btnPrimary, inputClass } from "@/components/ui/primitives";

/**
 * 빠른 기록.
 * 면접 직후에는 답변을 정리할 여유가 없다. 질문만 연달아 쏟아 넣고,
 * 답변과 보완점은 나중에 채우게 한다 (CLAUDE.md 4장 UX 원칙).
 *
 * 저장에 성공하면 칸을 비우고 다시 초점을 준다. 손을 떼지 않고 계속 칠 수 있다.
 */
export function QuickRecord({
  interviewId,
  lastQuestionId,
  lastQuestionText,
}: {
  interviewId: string;
  lastQuestionId: string | null;
  lastQuestionText: string | null;
}) {
  const [state, action, pending] = useActionState(addQuestion, null);
  const [asFollowUp, setAsFollowUp] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      inputRef.current?.focus();
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={action}
      className="rounded-xl border border-brand-200 bg-brand-50/40 p-4"
    >
      <input type="hidden" name="interview_id" value={interviewId} />
      {asFollowUp && lastQuestionId ? (
        <input type="hidden" name="parent_id" value={lastQuestionId} />
      ) : null}

      <p className="mb-2 text-sm font-bold">빠른 기록</p>
      <p className="mb-3 text-xs text-ink-500">
        받은 질문을 기억나는 대로 계속 넣으세요. 답변과 보완점은 나중에 채우면
        됩니다.
      </p>

      <textarea
        ref={inputRef}
        name="question"
        rows={2}
        required
        placeholder="예) 우리 회사에 지원한 이유가 무엇인가요?"
        className={inputClass}
        onKeyDown={(event) => {
          // 줄바꿈 없이 바로 넘길 수 있게 한다. 줄을 바꾸려면 Shift+Enter.
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            formRef.current?.requestSubmit();
          }
        }}
      />

      {lastQuestionId ? (
        <label className="mt-2 flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={asFollowUp}
            onChange={(event) => setAsFollowUp(event.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-brand-600"
          />
          <span className="text-sm text-ink-700">
            <span className="inline-flex items-center gap-1">
              <CornerDownRight className="size-3.5" aria-hidden />앞 질문의
              꼬리질문
            </span>
            <span className="mt-0.5 block truncate text-xs text-ink-400">
              {lastQuestionText}
            </span>
          </span>
        </label>
      ) : null}

      {state && !state.ok ? (
        <p className="mt-2 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
          {state.message}
        </p>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-ink-400">
          Enter 로 저장 · Shift+Enter 로 줄바꿈
        </span>
        <button type="submit" disabled={pending} className={btnPrimary}>
          <Plus className="size-4" aria-hidden />
          {pending ? "저장 중..." : "질문 추가"}
        </button>
      </div>
    </form>
  );
}
