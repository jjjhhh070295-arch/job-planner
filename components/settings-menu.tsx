"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  BellRing,
  Building2,
  CalendarCheck,
  FileStack,
  KeyRound,
  MessageSquare,
  Settings,
  ShieldUser,
  Ticket,
  X,
} from "lucide-react";

import { LogoutButton } from "@/components/logout-button";

/**
 * 톱니바퀴 → 설정 메뉴.
 *
 * 모바일에는 하단 탭 5개뿐이라 설정으로 갈 길이 없었다.
 * 데스크톱 사이드바에 있는 것과 같은 곳들을 여기에 모은다.
 * 좁은 화면에서는 아래에서 올라오는 시트로, 넓은 화면에서는 작은 메뉴로 뜬다.
 */

type Item = { href: string; label: string; icon: typeof Settings };

const COMMON: Item[] = [
  { href: "/settings/notifications", label: "알림 설정", icon: BellRing },
  { href: "/settings/password", label: "비밀번호 변경", icon: KeyRound },
  { href: "/settings", label: "설정", icon: Settings },
];

const ADMIN: Item[] = [
  { href: "/admin/users", label: "사용자 관리", icon: ShieldUser },
  { href: "/admin/invites", label: "초대 코드", icon: Ticket },
  { href: "/admin/shared-essays", label: "공용 자소서", icon: FileStack },
  { href: "/admin/feedback", label: "받은 의견", icon: MessageSquare },
  { href: "/admin/exams", label: "시험 일정", icon: CalendarCheck },
  { href: "/admin/dart", label: "DART 기업 목록", icon: Building2 },
  { href: "/admin/health", label: "서버 점검", icon: Activity },
];

export function SettingsMenu({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  // 열려 있는 동안 뒤 화면이 따라 움직이지 않게 막는다.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const link =
    "flex h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium text-ink-700 hover:bg-header";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="설정 메뉴 열기"
        className="tap inline-flex items-center justify-center rounded-lg border border-line bg-surface text-ink-700 hover:bg-header"
      >
        <Settings className="size-5" aria-hidden />
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="닫기"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-ink-900/40"
          />

          {/*
            모바일: 아래에서 올라오는 시트 (홈바 여백 포함)
            데스크톱: 오른쪽 위에 붙는 작은 메뉴
          */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="설정"
            className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl border border-line bg-surface pb-safe shadow-pop sm:inset-x-auto sm:top-16 sm:right-6 sm:bottom-auto sm:w-72 sm:rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="text-base font-bold">설정</p>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="닫기"
                className="tap inline-flex items-center justify-center rounded-lg text-ink-400 hover:bg-header"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            <div className="flex flex-col gap-0.5 p-2">
              {COMMON.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={link}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    {item.label}
                  </Link>
                );
              })}
            </div>

            {isAdmin ? (
              <div className="border-t border-line p-2">
                <p className="px-3 py-1.5 text-[11px] font-bold tracking-[0.12em] text-brand-600 uppercase">
                  관리자
                </p>
                <div className="flex flex-col gap-0.5">
                  {ADMIN.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={link}
                      >
                        <Icon className="size-4 shrink-0" aria-hidden />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="border-t border-line p-3">
              <LogoutButton />
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
