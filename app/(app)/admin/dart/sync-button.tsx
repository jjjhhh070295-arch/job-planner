"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";

import { btnPrimary } from "@/components/ui/primitives";
import type { FormState } from "@/lib/form-state";

export function SyncButton({
  action,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction}>
      {state ? (
        <p
          className={
            "mb-3 rounded-lg px-3 py-2 text-sm " +
            (state.ok
              ? "bg-success-50 text-success-700"
              : "bg-danger-50 text-danger-700")
          }
        >
          {state.message}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className={btnPrimary}>
        <RefreshCw className="size-4" aria-hidden />
        {pending ? "받는 중... (1분쯤 걸립니다)" : "목록 새로 받기"}
      </button>
    </form>
  );
}
