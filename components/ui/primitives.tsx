import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

/* ============================================================
   화면 전체가 같은 부품을 쓰도록 모아 둔 곳.
   색은 파란색(brand) 중심이고, 상태 색은 danger/success/muted 셋뿐이다.
   ============================================================ */

export type Tone = "brand" | "danger" | "success" | "muted";

const TONE_CLASS: Record<Tone, string> = {
  brand: "bg-brand-50 text-brand-700",
  danger: "bg-danger-50 text-danger-700",
  success: "bg-success-50 text-success-700",
  muted: "bg-muted-100 text-muted-600",
};

/** 상태 표시용 작은 알약. 남용하지 않도록 tone 을 넷으로 제한했다. */
export function Tag({
  tone = "muted",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span
      className={
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium " +
        TONE_CLASS[tone]
      }
    >
      {children}
    </span>
  );
}

export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={
        "rounded-xl border border-line bg-surface p-4 " + className
      }
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  count,
  moreHref,
  moreLabel = "전체 보기",
}: {
  title: string;
  count?: number;
  moreHref?: string;
  moreLabel?: string;
}) {
  return (
    <header className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-base font-bold">
        {title}
        {typeof count === "number" && count > 0 ? (
          <span className="ml-1.5 text-sm font-normal text-ink-400">
            {count}
          </span>
        ) : null}
      </h2>
      {moreHref ? (
        <Link
          href={moreHref}
          className="shrink-0 px-1 py-2 text-xs font-medium text-brand-600 hover:underline"
        >
          {moreLabel}
        </Link>
      ) : null}
    </header>
  );
}

/** 대시보드 상단 요약 숫자 한 칸 */
export function StatCard({
  label,
  value,
  unit,
  hint,
  tone = "brand",
  href,
}: {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  tone?: Tone;
  href?: string;
}) {
  const body = (
    <>
      <p className="truncate text-xs font-medium text-ink-500">{label}</p>
      <p className="mt-1 flex items-baseline gap-0.5">
        <span
          className={
            "text-2xl font-bold " +
            (tone === "danger"
              ? "text-danger-600"
              : tone === "success"
                ? "text-success-700"
                : tone === "muted"
                  ? "text-muted-600"
                  : "text-brand-600")
          }
        >
          {value}
        </span>
        {unit ? (
          <span className="text-sm font-medium text-ink-400">{unit}</span>
        ) : null}
      </p>
      {hint ? (
        <p className="mt-0.5 truncate text-[11px] text-ink-400">{hint}</p>
      ) : null}
    </>
  );

  const className =
    "flex min-w-0 flex-col justify-center rounded-xl border border-line bg-surface p-3";

  return href ? (
    <Link href={href} className={className + " hover:border-brand-200"}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** 데이터가 없을 때. 갈 곳을 버튼으로 준다. */
export function EmptyState({
  text,
  href,
  cta,
}: {
  text: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-line px-4 py-5">
      <p className="text-sm text-ink-500">{text}</p>
      {href && cta ? (
        <Link
          href={href}
          className="tap inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          {cta}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

export function SectionTitle({
  title,
  count,
  description,
}: {
  title: string;
  count?: number;
  description?: string;
}) {
  return (
    <div>
      <h2 className="text-base font-bold">
        {title}
        {typeof count === "number" ? (
          <span className="ml-1.5 text-sm font-normal text-ink-400">
            {count}
          </span>
        ) : null}
      </h2>
      {description ? (
        <p className="mt-0.5 text-sm text-ink-500">{description}</p>
      ) : null}
    </div>
  );
}

/* 버튼 모양을 한곳에서 관리한다. 높이는 터치 기준 44px. */
export const btnPrimary =
  "tap inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50";

export const btnGhost =
  "tap inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-4 text-sm font-medium text-ink-700 hover:bg-muted-100 disabled:opacity-50";

export const btnIcon =
  "tap inline-flex items-center justify-center rounded-lg text-ink-400 hover:bg-muted-100 hover:text-brand-600";

export const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-base outline-none focus:border-brand-500";
