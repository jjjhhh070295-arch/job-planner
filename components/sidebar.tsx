"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { KeyRound, Route, ShieldUser } from "lucide-react";

import { LogoutButton } from "@/components/logout-button";
import { NAV_ITEMS, isActive } from "@/components/nav-items";

type Props = {
  displayName: string;
  username: string;
  isAdmin: boolean;
};

export function Sidebar({ displayName, username, isAdmin }: Props) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-gray-200 bg-gray-50 md:flex">
      <div className="border-b border-gray-200 p-4">
        <p className="truncate font-bold">{displayName}</p>
        <p className="truncate text-sm text-gray-500">@{username}</p>
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
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium " +
                (active
                  ? "bg-blue-600 text-white"
                  : "text-gray-700 hover:bg-gray-200")
              }
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-1 border-t border-gray-200 p-3">
        <Link
          href="/roadmap"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-200"
        >
          <Route className="size-4 shrink-0" aria-hidden />
          목표 로드맵
        </Link>
        {isAdmin ? (
          <Link
            href="/admin/users"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-200"
          >
            <ShieldUser className="size-4 shrink-0" aria-hidden />
            사용자 관리
          </Link>
        ) : null}
        <Link
          href="/settings/password"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-200"
        >
          <KeyRound className="size-4 shrink-0" aria-hidden />
          비밀번호 변경
        </Link>
        <div className="px-1 pt-2">
          <LogoutButton />
        </div>
      </div>
    </aside>
  );
}
