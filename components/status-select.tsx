"use client";

import { useRef } from "react";

/** 칸반에서 단계를 옮기는 드롭다운. 고르면 바로 저장된다. */
export function StatusSelect({
  action,
  id,
  status,
  statuses,
  className = "",
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  status: string;
  statuses: readonly string[];
  className?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form action={action} ref={formRef}>
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={status}
        onChange={() => formRef.current?.requestSubmit()}
        aria-label="전형 단계"
        className={
          "rounded border border-gray-300 bg-white px-2 py-1 text-xs outline-none focus:border-blue-500 " +
          className
        }
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
