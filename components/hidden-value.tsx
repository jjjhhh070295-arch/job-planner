"use client";

import { useState } from "react";
import { Check, ClipboardCopy, Eye, EyeOff } from "lucide-react";

import { btnIcon } from "@/components/ui/primitives";

/**
 * 평소에는 가려 두고, 누르면 보이는 값.
 * 자격번호처럼 "가끔 꺼내 쓰지만 늘 보일 필요는 없는" 값에 쓴다.
 * 카페나 도서관에서 화면을 열어 둘 때 어깨너머로 보이는 것을 막는다.
 */
export function HiddenValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);

  return (
    <span className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-ink-400">{label}</span>

      <span
        className={
          "rounded px-2 py-0.5 font-mono text-sm " +
          (shown ? "bg-muted-100 text-ink-900" : "bg-muted-100 text-ink-400")
        }
      >
        {shown ? value : "••••••••"}
      </span>

      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        aria-label={shown ? `${label} 가리기` : `${label} 보기`}
        className={btnIcon}
      >
        {shown ? (
          <EyeOff className="size-4" aria-hidden />
        ) : (
          <Eye className="size-4" aria-hidden />
        )}
      </button>

      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            // 클립보드를 막아 둔 브라우저에서는 눈 아이콘으로 열어 직접 긁으면 된다.
          }
        }}
        aria-label={`${label} 복사`}
        className={btnIcon}
      >
        {copied ? (
          <Check className="size-4 text-success-700" aria-hidden />
        ) : (
          <ClipboardCopy className="size-4" aria-hidden />
        )}
      </button>
    </span>
  );
}
