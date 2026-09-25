"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { Tag, type Tone } from "@/components/ui/primitives";
import { countChars, type SharedEssay } from "@/lib/shared-essay";

/** 결과에 따라 색을 고른다. 색은 셋뿐이다 (CLAUDE.md 4장). */
function resultTone(result: string): Tone {
  if (result === "최종 합격") return "success";
  if (result === "불합격") return "muted";
  return "brand";
}

/** 읽기 전용 카드. 길어서 접어 두고 눌러 펼친다. */
export function SharedEssayCard({ essay }: { essay: SharedEssay }) {
  const [open, setOpen] = useState(false);
  const length = countChars(essay.answer);

  return (
    <li className="rounded-lg border border-line bg-surface shadow-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-2 p-4 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-bold">{essay.company}</span>
            {essay.role ? (
              <span className="text-xs text-ink-500">{essay.role}</span>
            ) : null}
            {essay.season ? (
              <span className="text-xs text-ink-400">{essay.season}</span>
            ) : null}
          </span>

          <span className="mt-1.5 block text-sm font-medium text-ink-900">
            {essay.question}
          </span>

          <span className="mt-2 flex flex-wrap items-center gap-1.5">
            {essay.category ? <Tag tone="brand">{essay.category}</Tag> : null}
            <Tag tone={resultTone(essay.result)}>{essay.result}</Tag>
            <span className="text-[11px] text-ink-400">
              공백 포함 {length.toLocaleString()}자
              {essay.char_limit
                ? ` · 제한 ${essay.char_limit.toLocaleString()}자`
                : ""}
            </span>
          </span>

          {!open ? (
            <span className="mt-2 line-clamp-2 block text-sm text-ink-500">
              {essay.answer}
            </span>
          ) : null}
        </span>

        <ChevronDown
          className={
            "mt-0.5 size-4 shrink-0 text-ink-400 transition-transform " +
            (open ? "rotate-180" : "")
          }
          aria-hidden
        />
      </button>

      {open ? (
        <div className="border-t border-line px-4 py-3">
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink-700">
            {essay.answer}
          </p>
          <p className="mt-3 border-t border-line pt-2 text-xs text-ink-400">
            참고용입니다. 문장을 그대로 쓰지 마세요.
          </p>
        </div>
      ) : null}
    </li>
  );
}
