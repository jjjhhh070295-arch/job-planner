"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";

import { FormFields, type Field } from "@/components/form-fields";
import { FormSheet } from "@/components/ui/form-sheet";
import { btnGhost, btnPrimary } from "@/components/ui/primitives";
import type { FormState } from "@/lib/form-state";

export type { Field };

/**
 * 항목을 새로 추가하는 폼.
 * 모바일에서는 아래에서 올라오는 시트, 데스크톱에서는 그 자리에 펼쳐진다.
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
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setOpen(false);
    }
  }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={btnGhost + " w-full border-dashed"}
      >
        <Plus className="size-4" aria-hidden />
        {openLabel}
      </button>

      <FormSheet open={open} onClose={() => setOpen(false)} title={openLabel}>
        <form ref={formRef} action={formAction}>
          <FormFields fields={fields} />

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
              {pending ? "저장 중..." : submitLabel}
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
    </>
  );
}
