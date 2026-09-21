"use client";

import Link from "next/link";
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
  { label: "공고 붙여넣기", icon: ClipboardPaste, href: "/applications/parse" },
  { label: "할 일", icon: CheckSquare, href: null },
  { label: "면접 기록", icon: MessagesSquare, href: null },
  { label: "공부 기록", icon: BookOpenCheck, href: null },
] as const;

/**
 * 모바일에서는 하단 탭(56px) + 홈바 위로 띄우고, 데스크톱에서는 화면 오른쪽 아래에 둔다.
 * 탭에 가리면 누를 수 없으므로 위치 계산에 안전 영역을 포함한다.
 */
const FAB_BOTTOM =
  "bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] md:bottom-6";
const MENU_BOTTOM =
  "bottom-[calc(8.5rem+env(safe-area-inset-bottom,0px))] md:bottom-24";

export function QuickAdd() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="닫기"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-ink-900/30"
        />
      ) : null}

      {open ? (
        <div
          className={
            "fixed right-4 z-40 w-56 rounded-xl border border-line bg-surface p-2 shadow-xl " +
            MENU_BOTTOM
          }
        >
          <p className="px-3 py-2 text-xs font-medium text-ink-500">
            빠른 추가
          </p>
          {QUICK_ITEMS.map((item) => {
            const Icon = item.icon;
            const inner = (
              <>
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="flex-1">{item.label}</span>
                {item.href === null ? (
                  <span className="text-[11px] text-ink-400">준비 중</span>
                ) : null}
              </>
            );
            const shared =
              "flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm";

            return item.href === null ? (
              <button
                key={item.label}
                type="button"
                disabled
                className={shared + " cursor-not-allowed text-ink-400"}
              >
                {inner}
              </button>
            ) : (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className={shared + " hover:bg-muted-100"}
              >
                {inner}
              </Link>
            );
          })}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "빠른 추가 닫기" : "빠른 추가"}
        aria-expanded={open}
        className={
          "fixed right-4 z-40 flex size-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg hover:bg-brand-700 " +
          FAB_BOTTOM
        }
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
