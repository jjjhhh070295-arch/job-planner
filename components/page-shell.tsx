import type { ReactNode } from "react";

/** 각 화면의 공통 뼈대. 제목 + 설명 + 본문. */
export function PageShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <main className="flex w-full min-w-0 flex-1 flex-col gap-4 px-4 py-4 md:gap-6 md:px-6 md:py-6">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold md:text-2xl">{title}</h1>
          {description ? (
            <p className="mt-0.5 text-sm text-ink-500">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </header>
      {children}
    </main>
  );
}
