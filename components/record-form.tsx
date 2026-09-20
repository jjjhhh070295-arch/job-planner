"use client";

import { useActionState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";

import type { FormState } from "@/app/(app)/profile/actions";

export type Field = {
  name: string;
  label: string;
  type?: "text" | "date" | "textarea" | "select";
  options?: string[];
  required?: boolean;
  placeholder?: string;
  hint?: string;
  /** 두 칸을 모두 차지할지 */
  wide?: boolean;
};

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500";

/**
 * 접었다 펴는 추가 폼. 목록 위에 항상 펼쳐 두면 화면이 길어져서,
 * 기본은 접힌 상태로 둔다.
 */
export function RecordForm({
  action,
  fields,
  openLabel,
  submitLabel = "추가",
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  fields: Field[];
  openLabel: string;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <details className="rounded-lg border border-gray-200">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-blue-600">
        <ChevronDown className="size-4" aria-hidden />
        {openLabel}
      </summary>

      <form ref={formRef} action={formAction} className="border-t border-gray-200 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {fields.map((field) => (
            <label
              key={field.name}
              className={
                "flex flex-col gap-1.5 " +
                (field.wide || field.type === "textarea" ? "sm:col-span-2" : "")
              }
            >
              <span className="text-xs font-medium text-gray-700">
                {field.label}
                {field.required ? (
                  <span className="text-red-500"> *</span>
                ) : null}
              </span>

              {field.type === "textarea" ? (
                <textarea
                  name={field.name}
                  rows={3}
                  required={field.required}
                  placeholder={field.placeholder}
                  className={inputClass}
                />
              ) : field.type === "select" ? (
                <select
                  name={field.name}
                  defaultValue={field.options?.[0]}
                  className={inputClass}
                >
                  {field.options?.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type === "date" ? "date" : "text"}
                  name={field.name}
                  required={field.required}
                  placeholder={field.placeholder}
                  className={inputClass}
                />
              )}

              {field.hint ? (
                <span className="text-xs text-gray-400">{field.hint}</span>
              ) : null}
            </label>
          ))}
        </div>

        {state && !state.ok ? (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
            {state.message}
          </p>
        ) : null}
        {state?.ok ? (
          <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            {state.message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "저장 중..." : submitLabel}
        </button>
      </form>
    </details>
  );
}
