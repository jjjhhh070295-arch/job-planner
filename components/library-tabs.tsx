"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** 라이브러리 안에서 옮겨 다니는 탭. 내 것과 남의 것을 확실히 갈라 둔다. */
const TABS = [
  { href: "/library", label: "내 라이브러리" },
  { href: "/library/shared", label: "공용 자소서" },
];

export function LibraryTabs() {
  const pathname = usePathname();

  return (
    <div className="-mx-4 overflow-x-auto px-4 no-scrollbar md:mx-0 md:px-0">
      <nav className="flex min-w-max gap-1 border-b border-line">
        {TABS.map((tab) => {
          const active =
            tab.href === "/library"
              ? pathname === "/library"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={
                "-mb-px flex h-11 items-center border-b-2 px-3 text-sm font-semibold " +
                (active
                  ? "border-brand-600 text-brand-600"
                  : "border-transparent text-ink-500 hover:text-ink-700")
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
