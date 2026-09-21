import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** 대시보드에 올라가는 카드 한 장. */
export function DashboardCard({
  title,
  count,
  moreHref,
  moreLabel,
  children,
}: {
  title: string;
  count?: number;
  moreHref?: string;
  moreLabel?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-lg border border-gray-200 p-4">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-bold">
          {title}
          {typeof count === "number" && count > 0 ? (
            <span className="ml-2 text-sm font-normal text-gray-400">
              {count}
            </span>
          ) : null}
        </h2>
        {moreHref ? (
          <Link
            href={moreHref}
            className="shrink-0 text-xs font-medium text-blue-600 hover:underline"
          >
            {moreLabel ?? "전체 보기"}
          </Link>
        ) : null}
      </header>
      {children}
    </section>
  );
}

/**
 * 데이터가 없을 때 보여 주는 안내.
 * 빈 화면만 두면 무엇을 해야 할지 모르므로 갈 곳을 버튼으로 준다.
 */
export function EmptyCard({
  text,
  href,
  cta,
}: {
  text: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-gray-300 p-4">
      <p className="text-sm text-gray-500">{text}</p>
      <Link
        href={href}
        className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        {cta}
        <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </div>
  );
}
