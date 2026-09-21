"use client";

import { useRef } from "react";

/** 전형 단계를 바꾸는 드롭다운. 고르면 바로 저장된다. */
export function StatusSelect({
  action,
  id,
  status,
  statuses,
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  status: string;
  statuses: readonly string[];
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form action={action} ref={formRef}>
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={status}
        onChange={() => formRef.current?.requestSubmit()}
        aria-label="전형 단계 바꾸기"
        className="h-11 rounded-lg border border-line bg-surface px-2 text-sm text-ink-700 outline-none focus:border-brand-500"
      >
        {statuses.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </form>
  );
}
