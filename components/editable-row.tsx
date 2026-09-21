"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { Pencil, X } from "lucide-react";

import { FormFields, type Field } from "@/components/form-fields";
import type { FormState } from "@/lib/form-state";

/**
 * 목록의 항목 한 줄. 연필을 누르면 아래로 수정 폼이 펼쳐진다.
 * 수정 폼은 추가 폼과 같은 입력 칸을 쓰므로 규칙이 어긋날 일이 없다.
 */
export function EditableRow({
  action,
  fields,
  defaults,
  id,
  title,
  deleteSlot,
  children,
  className = "rounded-lg border border-gray-200 p-4",
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  fields: Field[];
  defaults: Record<string, string | null | undefined>;
  id: string;
  title: string;
  deleteSlot?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, null);

  // 저장에 성공하면 폼을 닫는다. 바뀐 내용은 목록에 바로 반영된다.
  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <div className={className}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">{children}</div>
        <div className="flex shrink-0 items-start">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? `${title} 수정 닫기` : `${title} 수정`}
            aria-expanded={open}
            className={
              "rounded-md p-2 hover:bg-gray-100 " +
              (open ? "text-blue-600" : "text-gray-400 hover:text-blue-600")
            }
          >
            {open ? (
              <X className="size-4" aria-hidden />
            ) : (
              <Pencil className="size-4" aria-hidden />
            )}
          </button>
          {deleteSlot}
        </div>
      </div>

      {open ? (
        <form
          action={formAction}
          className="mt-4 rounded-lg border border-blue-200 bg-blue-50/40 p-4"
        >
          <input type="hidden" name="id" value={id} />

          <FormFields fields={fields} defaults={defaults} />

          {state && !state.ok ? (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              {state.message}
            </p>
          ) : null}

          <div className="mt-4 flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {pending ? "저장 중..." : "저장"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              취소
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
