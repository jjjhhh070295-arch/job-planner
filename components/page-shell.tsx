import type { ReactNode } from "react";

/**
 * 각 화면의 공통 뼈대. 머리글 + 본문.
 *
 * 참고 화면(docs/ui-reference.png)처럼 제목 아래에 짧은 파란 막대를 둬서
 * 화면이 어디서 시작하는지 눈으로 잡아 준다.
 */
export function PageShell({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  /** 제목 위 작은 글씨. 어느 묶음에 속한 화면인지 */
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <main className="flex w-full min-w-0 flex-1 flex-col gap-4 px-4 py-4 md:gap-5 md:px-6 md:py-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="mb-1 text-xs font-medium text-brand-600">{eyebrow}</p>
          ) : null}
          <h1 className="truncate text-xl font-bold tracking-tight md:text-2xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 text-sm text-ink-500">{description}</p>
          ) : null}
          <span
            aria-hidden
            className="mt-2 block h-[3px] w-7 rounded-full bg-brand-600"
          />
        </div>

        {/*
          모바일에서는 버튼이 여러 개면 한 줄에 다 안 들어간다.
          줄바꿈을 허용하고, 데스크톱에서만 오른쪽 위로 보낸다.
        */}
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 md:shrink-0 md:justify-end">
            {actions}
          </div>
        ) : null}
      </header>
      {children}
    </main>
  );
}
