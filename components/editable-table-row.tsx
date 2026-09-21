"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { Pencil } from "lucide-react";

import { FormFields, type Field } from "@/components/form-fields";
import { FormSheet } from "@/components/ui/form-sheet";
import { btnGhost, btnIcon, btnPrimary } from "@/components/ui/primitives";
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
      <tr className="hover:bg-muted-100/60">
        {children}
        <td className="px-2 py-1.5">
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={`${title} 수정`}
              className={btnIcon}
            >
              <Pencil className="size-4" aria-hidden />
            </button>
            {deleteSlot}
          </div>
        </td>
      </tr>

      {open ? (
        <tr>
          <td colSpan={columnCount} className="p-0">
            <FormSheet
              open={open}
              onClose={() => setOpen(false)}
              title={`${title} 수정`}
            >
              <form action={formAction}>
                <input type="hidden" name="id" value={id} />

                <FormFields fields={fields} defaults={defaults} />

                {state && !state.ok ? (
                  <p className="mt-3 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
                    {state.message}
                  </p>
                ) : null}

                <div className="mt-4 flex gap-2">
                  <button
                    type="submit"
                    disabled={pending}
                    className={btnPrimary + " flex-1 md:flex-none"}
                  >
                    {pending ? "저장 중..." : "저장"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className={btnGhost}
                  >
                    취소
                  </button>
                </div>
              </form>
            </FormSheet>
          </td>
        </tr>
      ) : null}
    </>
  );
}
