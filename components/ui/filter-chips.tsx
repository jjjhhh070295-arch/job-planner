"use client";

export type Chip = {
  value: string;
  label: string;
  count?: number;
};

/**
 * 한 줄로 가로 스크롤되는 필터 칩.
 * 모바일에서 줄바꿈으로 쌓이면 목록이 아래로 밀려 내려가서, 한 줄을 유지하고 밀어서 본다.
 * 바깥 여백을 음수로 빼서 화면 가장자리까지 스크롤되게 하되,
 * 이 줄 자체는 화면 폭을 넘지 않으므로 문서 전체에 가로 스크롤이 생기지 않는다.
 */
export function FilterChips({
  chips,
  value,
  onChange,
  label,
}: {
  chips: Chip[];
  value: string;
  onChange: (next: string) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="-mx-4 overflow-x-auto px-4 no-scrollbar md:mx-0 md:px-0"
    >
      <div className="flex w-max gap-2 py-0.5">
        {chips.map((chip) => {
          const active = chip.value === value;
          return (
            <button
              key={chip.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(chip.value)}
              className={
                "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg border px-3.5 text-sm font-semibold " +
                (active
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-line bg-surface text-ink-700 hover:bg-header")
              }
            >
              {chip.label}
              {typeof chip.count === "number" ? (
                <span
                  className={
                    "text-xs " + (active ? "text-brand-100" : "text-ink-400")
                  }
                >
                  {chip.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
