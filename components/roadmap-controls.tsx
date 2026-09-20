"use client";

import { Minus, Plus, Square, SquareCheckBig, Star } from "lucide-react";

type Action = (formData: FormData) => Promise<void>;

/** 할 일 완료 체크. 모바일에서 누르기 쉽도록 터치 영역을 넉넉히 둔다. */
export function TaskCheckbox({
  action,
  id,
  done,
  title,
}: {
  action: Action;
  id: string;
  done: boolean;
  title: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="next" value={String(!done)} />
      <button
        type="submit"
        aria-label={done ? `${title} 완료 취소` : `${title} 완료`}
        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100"
      >
        {done ? (
          <SquareCheckBig className="size-5 text-blue-600" aria-hidden />
        ) : (
          <Square className="size-5" aria-hidden />
        )}
      </button>
    </form>
  );
}

/** 오늘 할 일로 올리기 / 내리기 */
export function TodayToggle({
  action,
  id,
  isToday,
}: {
  action: Action;
  id: string;
  isToday: boolean;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="next" value={String(!isToday)} />
      <button
        type="submit"
        title={isToday ? "오늘 할 일에서 빼기" : "오늘 할 일로 올리기"}
        aria-label={isToday ? "오늘 할 일에서 빼기" : "오늘 할 일로 올리기"}
        className="rounded-md p-1.5 hover:bg-gray-100"
      >
        <Star
          className={
            "size-4 " +
            (isToday ? "fill-amber-400 text-amber-400" : "text-gray-300")
          }
          aria-hidden
        />
      </button>
    </form>
  );
}

/** 직접 세는 마일스톤의 숫자 조절 */
export function MilestoneBump({
  action,
  id,
}: {
  action: Action;
  id: string;
}) {
  return (
    <div className="flex items-center gap-1">
      {[
        { delta: -1, Icon: Minus, label: "1 줄이기" },
        { delta: 1, Icon: Plus, label: "1 늘리기" },
      ].map(({ delta, Icon, label }) => (
        <form action={action} key={delta}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="delta" value={delta} />
          <button
            type="submit"
            aria-label={label}
            className="rounded border border-gray-300 p-1 text-gray-500 hover:bg-gray-50"
          >
            <Icon className="size-3.5" aria-hidden />
          </button>
        </form>
      ))}
    </div>
  );
}
