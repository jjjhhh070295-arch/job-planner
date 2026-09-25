"use client";

import { useActionState } from "react";
import { PlugZap } from "lucide-react";

import { btnGhost } from "@/components/ui/primitives";
import type { FormState } from "@/lib/form-state";

export function TestButton({
  action,
  label,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="mt-3">
      <button type="submit" disabled={pending} className={btnGhost}>
        <PlugZap className="size-4" aria-hidden />
        {pending ? "확인 중..." : label}
      </button>

      {state ? (
        <p
          className={
            "mt-2 rounded-lg px-3 py-2 text-sm " +
            (state.ok
              ? "bg-success-50 text-success-700"
              : "bg-danger-50 text-danger-700")
          }
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
