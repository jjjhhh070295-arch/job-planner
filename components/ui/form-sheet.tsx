"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

import { btnIcon } from "@/components/ui/primitives";

/**
 * 폼을 담는 껍데기.
 * 모바일에서는 아래에서 올라오는 시트, 데스크톱(md 이상)에서는 그 자리에 펼쳐지는 판.
 *
 * DOM 은 하나만 두고 CSS 로만 모양을 바꾼다. 두 벌로 만들면 입력값이 어긋난다.
 */
export function FormSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  // 시트가 열린 동안 뒤 화면이 스크롤되면 어디를 보고 있었는지 잃는다.
  useEffect(() => {
    if (!open) return;

    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (!isMobile) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Esc 로 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* 모바일에서만 뒤를 덮는다 */}
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-ink-900/40 md:hidden"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={
          // 모바일: 화면 아래 고정 시트
          "fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-2xl border border-line bg-surface pb-safe shadow-2xl " +
          // 데스크톱: 흐름 안의 보통 상자
          "md:static md:z-auto md:max-h-none md:overflow-visible md:rounded-xl md:border-brand-200 md:bg-brand-50/40 md:pb-0 md:shadow-none"
        }
      >
        {/* 모바일 시트 손잡이 + 제목줄 */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-line bg-surface px-4 py-3 md:hidden">
          <p className="truncate text-base font-bold">{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className={btnIcon}
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="p-4">{children}</div>
      </div>
    </>
  );
}
