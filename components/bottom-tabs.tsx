"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_ITEMS, isActive } from "@/components/nav-items";

/**
 * 모바일 전용 하단 탭. CLAUDE.md 4장대로 5개 고정.
 * 아이폰 홈바에 가리지 않도록 아래쪽 안전 영역만큼 여백을 둔다.
 */
export function BottomTabs() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-safe md:hidden">
      <ul className="flex">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="min-w-0 flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium " +
                  (active ? "text-brand-600" : "text-ink-400")
                }
              >
                <Icon className="size-5 shrink-0" aria-hidden />
                <span className="max-w-full truncate px-0.5">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
