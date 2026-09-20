"use client";

import { Trash2 } from "lucide-react";

import { removeProfileRow } from "@/app/(app)/profile/actions";

/** 확인 없이 지우면 실수로 날리기 쉬워서 한 번 물어본다. */
export function DeleteRowButton({
  table,
  id,
  label,
}: {
  table: string;
  id: string;
  label: string;
}) {
  return (
    <form
      action={removeProfileRow}
      onSubmit={(event) => {
        if (!window.confirm(`"${label}" 을(를) 지울까요? 되돌릴 수 없습니다.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="table" value={table} />
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        aria-label={`${label} 삭제`}
        className="rounded-md p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    </form>
  );
}
