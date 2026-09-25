import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

/* ============================================================
   화면 전체가 같은 부품을 쓰도록 모아 둔 곳.

   모양 규칙 (docs/ui-reference.png 기준)
   - 색: 파란색(brand) 중심. 상태 색은 danger/success/muted 셋뿐
   - 곡률: 카드·버튼·입력칸 모두 8px(rounded-lg), 알약만 full
   - 그림자: 거의 안 쓴다. 선(border)으로 구분하고 떠 있는 것만 얕게
   - 글자: 제목 굵게, 설명은 ink-500, 아주 작은 보조 글자는 ink-400
   - 누르는 것은 전부 44px 이상, 입력칸 글자는 16px
   ============================================================ */

export type Tone = "brand" | "danger" | "success" | "muted";

const TONE_CHIP: Record<Tone, string> = {
  brand: "bg-brand-50 text-brand-700",
  danger: "bg-danger-50 text-danger-700",
  success: "bg-success-50 text-success-700",
  muted: "bg-muted-100 text-muted-600",
};

const TONE_TEXT: Record<Tone, string> = {
  brand: "text-brand-600",
  danger: "text-danger-600",
  success: "text-success-700",
  muted: "text-muted-600",
};

const TONE_BAR: Record<Tone, string> = {
  brand: "bg-brand-600",
  danger: "bg-danger-600",
  success: "bg-success-700",
  muted: "bg-ink-400",
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
        TONE_CHIP[tone]
      }
    >
      {children}
    </span>
  );
}

/**
 * 개수를 보여 주는 작은 알약. 참고 화면의 "0건" 자리.
 * Tag 와 달리 제목 옆 오른쪽 끝에 붙는 용도다.
 */
export function Badge({
  tone = "brand",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span
      className={
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold " +
        TONE_CHIP[tone]
      }
    >
      {children}
    </span>
  );
}

/** 묶음 위에 붙는 아주 작은 머리글. 참고 화면의 "BOOK INSIGHT" 자리. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-bold tracking-[0.12em] text-brand-600 uppercase">
      {children}
    </p>
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
        "rounded-lg border border-line bg-surface p-4 shadow-card " + className
      }
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  count,
  badge,
  moreHref,
  moreLabel = "전체 보기",
}: {
  title: string;
  count?: number;
  /** 오른쪽 끝 알약. 예: "3건" */
  badge?: ReactNode;
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
      {badge ? <Badge>{badge}</Badge> : null}
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

/**
 * 요약 숫자 여러 칸을 한 덩어리로 묶는다.
 * 칸 사이는 1px 선으로만 나뉜다 (바탕색을 선 색으로 두고 gap-px 로 비춰 낸다).
 * 375px 에서는 두 칸씩, 넓은 화면에서는 네 칸.
 */
export function StatGrid({
  columns = 4,
  children,
}: {
  columns?: 2 | 3 | 4;
  children: ReactNode;
}) {
  const wide =
    columns === 2 ? "md:grid-cols-2" : columns === 3 ? "md:grid-cols-3" : "md:grid-cols-4";
  return (
    <div
      className={
        "grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line shadow-card " +
        wide
      }
    >
      {children}
    </div>
  );
}

/** 요약 숫자 한 칸. 왼쪽에 색 막대를 세워 숫자를 붙잡아 준다. */
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
      <div className="mt-1.5 flex items-center gap-2">
        <span
          aria-hidden
          className={"h-6 w-[3px] shrink-0 rounded-full " + TONE_BAR[tone]}
        />
        <span className="flex min-w-0 items-baseline gap-0.5">
          <span
            className={"nums truncate text-2xl font-bold " + TONE_TEXT[tone]}
          >
            {value}
          </span>
          {unit ? (
            <span className="shrink-0 text-sm font-medium text-ink-400">
              {unit}
            </span>
          ) : null}
        </span>
      </div>
      {hint ? (
        <p className="mt-1 truncate text-[11px] text-ink-400">{hint}</p>
      ) : null}
    </>
  );

  const className = "flex min-w-0 flex-col justify-center bg-surface p-4";

  return href ? (
    <Link href={href} className={className + " hover:bg-brand-50/50"}>
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
  center = false,
}: {
  text: string;
  href?: string;
  cta?: string;
  /** 넓은 빈 칸을 채울 때는 가운데로 */
  center?: boolean;
}) {
  return (
    <div
      className={
        "flex flex-col gap-3 rounded-lg border border-dashed border-line px-4 py-8 " +
        (center ? "items-center text-center" : "items-start")
      }
    >
      <p className="text-sm text-ink-500">{text}</p>
      {href && cta ? (
        <Link href={href} className={btnPrimary}>
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
    <div className="min-w-0">
      <h2 className="text-base font-bold md:text-lg">
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

/* ------------------------------------------------------------
   표
   머리글은 옅은 회색 줄, 본문은 흰 줄. 줄 사이는 선 하나.
   좁은 화면에서 넘칠 수 있으므로 반드시 TableWrap 안에 넣는다.
   ------------------------------------------------------------ */

/** 표를 감싸 가로 스크롤을 표 안에만 가둔다. 화면 전체가 밀리지 않게. */
export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto md:mx-0">
      <div className="min-w-full px-4 md:px-0">{children}</div>
    </div>
  );
}

export const tableClass = "w-full border-collapse text-sm";

export const theadClass =
  "border-y border-line bg-header text-xs font-semibold text-ink-500";

export const thClass = "px-3 py-2.5 text-left whitespace-nowrap";

export const trClass = "border-b border-line last:border-b-0 hover:bg-header";

export const tdClass = "px-3 py-3 align-middle";

/* ------------------------------------------------------------
   버튼 · 입력칸
   ------------------------------------------------------------ */

/** 가장 중요한 동작 하나에만. 한 화면에 여러 개 두지 않는다. */
export const btnPrimary =
  "tap inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50";

/** 그 밖의 동작. 흰 바탕에 선. */
export const btnGhost =
  "tap inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-4 text-sm font-medium text-ink-700 hover:bg-header disabled:opacity-50";

/** 지우기처럼 되돌리기 어려운 동작. */
export const btnDanger =
  "tap inline-flex items-center justify-center gap-1.5 rounded-lg border border-danger-100 bg-surface px-4 text-sm font-medium text-danger-700 hover:bg-danger-50 disabled:opacity-50";

/** 표 안에서 쓰는 작은 버튼. 44px 규칙은 표 밖 버튼에 적용한다. */
export const btnSmall =
  "inline-flex h-8 items-center justify-center gap-1 rounded-md border border-brand-200 bg-surface px-2.5 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50";

export const btnIcon =
  "tap inline-flex items-center justify-center rounded-lg text-ink-400 hover:bg-header hover:text-brand-600";

export const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-base outline-none placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export const labelClass = "text-sm font-medium text-ink-700";
