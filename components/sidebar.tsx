"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BellRing,
  FileStack,
  KeyRound,
  MessageSquare,
  MessagesSquare,
  Route,
  Settings,
  Activity,
  Building2,
  BookOpenCheck,
  Share2,
  CalendarCheck,
  ShieldUser,
  Ticket,
} from "lucide-react";

import { LogoutButton } from "@/components/logout-button";
import { NAV_ITEMS, isActive } from "@/components/nav-items";

type Props = {
  displayName: string;
  username: string;
  isAdmin: boolean;
};

const subLink =
  "flex h-11 items-center gap-3 rounded-lg px-3 text-sm text-ink-700 hover:bg-muted-100";

export function Sidebar({ displayName, username, isAdmin }: Props) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface md:flex">
      <div className="border-b border-line p-4">
        <p className="truncate font-bold">{displayName}</p>
        <p className="truncate text-sm text-ink-500">@{username}</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={
                "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium " +
                (active
                  ? "bg-brand-600 text-white"
                  : "text-ink-700 hover:bg-muted-100")
              }
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-1 border-t border-line p-3">
        <Link href="/roadmap" className={subLink}>
          <Route className="size-4 shrink-0" aria-hidden />
          목표 로드맵
        </Link>
        <Link href="/interviews" className={subLink}>
          <MessagesSquare className="size-4 shrink-0" aria-hidden />
          면접 복기
        </Link>
        <Link href="/study" className={subLink}>
          <BookOpenCheck className="size-4 shrink-0" aria-hidden />
          공부 기록
        </Link>
        <Link href="/sharing" className={subLink}>
          <Share2 className="size-4 shrink-0" aria-hidden />
          공유
        </Link>
        {isAdmin ? (
          <>
            <Link href="/admin/users" className={subLink}>
              <ShieldUser className="size-4 shrink-0" aria-hidden />
              사용자 관리
            </Link>
            <Link href="/admin/invites" className={subLink}>
              <Ticket className="size-4 shrink-0" aria-hidden />
              초대 코드
            </Link>
            <Link href="/admin/feedback" className={subLink}>
              <MessageSquare className="size-4 shrink-0" aria-hidden />
              받은 의견
            </Link>
            <Link href="/admin/shared-essays" className={subLink}>
              <FileStack className="size-4 shrink-0" aria-hidden />
              공용 자소서
            </Link>
            <Link href="/admin/exams" className={subLink}>
              <CalendarCheck className="size-4 shrink-0" aria-hidden />
              시험 일정
            </Link>
            <Link href="/admin/dart" className={subLink}>
              <Building2 className="size-4 shrink-0" aria-hidden />
              DART 기업 목록
            </Link>
            <Link href="/admin/health" className={subLink}>
              <Activity className="size-4 shrink-0" aria-hidden />
              서버 점검
            </Link>
          </>
        ) : null}
        <Link href="/settings" className={subLink}>
          <Settings className="size-4 shrink-0" aria-hidden />
          설정
        </Link>
        <Link href="/settings/notifications" className={subLink}>
          <BellRing className="size-4 shrink-0" aria-hidden />
          알림
        </Link>
        <Link href="/settings/password" className={subLink}>
          <KeyRound className="size-4 shrink-0" aria-hidden />
          비밀번호 변경
        </Link>
        <div className="pt-2">
          <LogoutButton />
        </div>
      </div>
    </aside>
  );
}
