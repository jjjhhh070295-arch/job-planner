"use client";

import { useActionState, useState } from "react";
import { Check, ClipboardCopy, FileUp } from "lucide-react";

import { FormSheet } from "@/components/ui/form-sheet";
import { btnGhost, btnPrimary, inputClass } from "@/components/ui/primitives";
import { buildProfileImportPrompt } from "@/lib/essay-prompt";
import type { FormState } from "@/lib/form-state";

/**
 * 이력서로 프로필 한 번에 채우기.
 * 이력서 원문은 이 앱이 AI 로 보내지 않는다 (CLAUDE.md 3장 5번).
 * 프롬프트만 만들어 주고, 사용자가 받은 JSON 을 붙여넣는 방식이다.
 */
export function ProfileImport({
  action,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [state, formAction, pending] = useActionState(action, null);

  const prompt = buildProfileImportPrompt();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={btnGhost + " w-full border-dashed"}
      >
        <FileUp className="size-4" aria-hidden />
        이력서로 한 번에 채우기
      </button>

      <FormSheet
        open={open}
        onClose={() => setOpen(false)}
        title="이력서로 한 번에 채우기"
      >
        <div className="flex flex-col gap-4">
          <ol className="flex flex-col gap-1.5 rounded-lg bg-brand-50 px-3 py-2.5 text-sm text-brand-700">
            <li>1. 아래 프롬프트를 복사합니다.</li>
            <li>
              2. 쓰시는 AI 채팅에 붙여넣고, 맨 아래 &lt;이력서&gt; 자리에 이력서
              내용을 넣습니다.
            </li>
            <li>3. AI가 준 JSON을 그대로 복사해 아래 칸에 붙여넣습니다.</li>
          </ol>

          <p className="text-xs text-ink-500">
            이력서 원문은 이 앱이 AI로 보내지 않습니다. 여러분이 직접 쓰는 AI
            채팅에서만 처리됩니다.
          </p>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-ink-700">프롬프트</p>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(prompt);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1800);
                  } catch {
                    // 복사를 막아 둔 브라우저에서는 아래 칸에서 직접 긁어 복사한다.
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
              rows={7}
              className={inputClass + " font-mono text-xs"}
            />
          </div>

          <form action={formAction}>
            <p className="mb-2 text-sm font-medium text-ink-700">
              받은 JSON 붙여넣기
            </p>
            <textarea
              name="json"
              rows={7}
              required
              placeholder='{"education": [...], "experiences": [...]}'
              className={inputClass + " font-mono text-xs"}
            />

            {state ? (
              <p
                className={
                  "mt-2 rounded-lg px-3 py-2 text-sm " +
                  (state.ok
                    ? "bg-success-50 text-success-700"
                    : "bg-danger-50 text-danger-700")
                }
              >
                {state.message}
              </p>
            ) : null}

            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                disabled={pending}
                className={btnPrimary + " flex-1 md:flex-none"}
              >
                {pending ? "넣는 중..." : "프로필에 넣기"}
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
