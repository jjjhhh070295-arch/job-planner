"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { Pencil } from "lucide-react";

import { FormFields, type Field } from "@/components/form-fields";
import { FormSheet } from "@/components/ui/form-sheet";
import { btnGhost, btnIcon, btnPrimary } from "@/components/ui/primitives";
import type { FormState } from "@/lib/form-state";

/**
 * 목록의 항목 한 줄. 연필을 누르면 수정 폼이 열린다.
 * 모바일은 아래에서 올라오는 시트, 데스크톱은 그 자리에 펼쳐지는 판.
 */
export function EditableRow({
  action,
  fields,
  defaults,
  id,
  title,
  deleteSlot,
  children,
  className = "rounded-xl border border-line bg-surface p-4",
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
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">{children}</div>
        <div className="flex shrink-0 items-start">
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
      </div>

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
    </div>
  );
}
