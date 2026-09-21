"use client";

import { useActionState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";

import { FormFields, type Field } from "@/components/form-fields";
import type { FormState } from "@/lib/form-state";

export type { Field };

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

      <form
        ref={formRef}
        action={formAction}
        className="border-t border-gray-200 p-4"
      >
        <FormFields fields={fields} />

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
