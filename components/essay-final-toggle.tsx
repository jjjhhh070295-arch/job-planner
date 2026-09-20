"use client";

/** 초안 <-> 최종 전환 버튼. 누르면 바로 저장된다. */
export function EssayFinalToggle({
  action,
  id,
  isFinal,
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  isFinal: boolean;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="next" value={String(!isFinal)} />
      <button
        type="submit"
        title={isFinal ? "초안으로 되돌리기" : "최종본으로 표시"}
        className={
          "rounded-full px-2 py-0.5 text-xs font-medium " +
          (isFinal
            ? "bg-green-100 text-green-800 hover:bg-green-200"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200")
        }
      >
        {isFinal ? "최종" : "초안"}
      </button>
    </form>
  );
}
