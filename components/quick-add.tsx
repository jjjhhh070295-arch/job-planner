"use client";

import { useState } from "react";
import {
  BookOpenCheck,
  CheckSquare,
  ClipboardPaste,
  MessagesSquare,
  Plus,
  X,
} from "lucide-react";

// CLAUDE.md 4장의 빠른 추가 4종.
// 해당 기능이 아직 없는 항목은 눌러도 동작하지 않게 두고, 기능이 붙을 때 href 를 채운다.
const QUICK_ITEMS = [
  { label: "공고 붙여넣기", icon: ClipboardPaste, href: null },
  { label: "할 일", icon: CheckSquare, href: null },
  { label: "면접 기록", icon: MessagesSquare, href: null },
  { label: "공부 기록", icon: BookOpenCheck, href: null },
] as const;

export function QuickAdd() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="닫기"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/30"
        />
      ) : null}

      {open ? (
        <div className="fixed right-4 bottom-32 z-40 w-56 rounded-lg border border-gray-200 bg-white p-2 shadow-lg md:bottom-20">
          <p className="px-3 py-2 text-xs font-medium text-gray-500">
            빠른 추가
          </p>
          {QUICK_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                disabled={item.href === null}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent"
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="flex-1">{item.label}</span>
                {item.href === null ? (
                  <span className="text-[11px] text-gray-400">준비 중</span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "빠른 추가 닫기" : "빠른 추가"}
        className="fixed right-4 bottom-20 z-40 flex size-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 md:bottom-6"
      >
        {open ? (
          <X className="size-6" aria-hidden />
        ) : (
          <Plus className="size-6" aria-hidden />
        )}
      </button>
    </>
  );
}
