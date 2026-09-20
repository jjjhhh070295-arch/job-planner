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
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold md:text-2xl">{title}</h1>
          {description ? (
            <p className="mt-1 text-sm text-gray-500">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </header>
      {children}
    </main>
  );
}

/** 기능이 아직 없는 화면에 쓰는 자리 표시. 무엇이 들어올지 적어 둔다. */
export function ComingSoon({ items }: { items: string[] }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 p-6">
      <p className="text-sm font-medium text-gray-600">
        아직 만들지 않은 화면입니다. 여기에 들어올 내용:
      </p>
      <ul className="mt-3 flex flex-col gap-1.5 text-sm text-gray-500">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden>·</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
