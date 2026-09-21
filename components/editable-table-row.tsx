"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { Pencil, X } from "lucide-react";

import { FormFields, type Field } from "@/components/form-fields";
import type { FormState } from "@/lib/form-state";

/**
 * 표 보기용 수정 행.
 * 연필을 누르면 바로 아래에 폼 한 줄이 펼쳐진다 (colSpan 으로 표 전체 너비 사용).
 */
export function EditableTableRow({
  action,
  fields,
  defaults,
  id,
  title,
  columnCount,
  deleteSlot,
  children,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  fields: Field[];
  defaults: Record<string, string | null | undefined>;
  id: string;
  title: string;
  columnCount: number;
  deleteSlot?: ReactNode;
  /** 앞쪽 td 들 */
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, null);

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <>
      <tr>
        {children}
        <td className="px-3 py-2">
          <div className="flex items-center justify-end">
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
        </td>
      </tr>

      {open ? (
        <tr>
          <td colSpan={columnCount} className="bg-blue-50/40 px-3 py-4">
            <form action={formAction}>
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
          </td>
        </tr>
      ) : null}
    </>
  );
}
