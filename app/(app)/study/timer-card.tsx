"use client";

import { useActionState, useEffect, useState } from "react";
import { Play, Square, X } from "lucide-react";

import { cancelTimer, startTimer, stopTimer } from "./actions";
import { btnGhost, btnPrimary, inputClass } from "@/components/ui/primitives";

/** 1234 초 -> "20분 34초" */
function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}시간 ${m}분 ${s}초`;
  if (m > 0) return `${m}분 ${s}초`;
  return `${s}초`;
}

export function TimerCard({
  running,
  milestones,
  subjects,
}: {
  running: { id: string; subject: string; startedAt: string } | null;
  milestones: { value: string; label: string }[];
  subjects: string[];
}) {
  const [state, action, pending] = useActionState(startTimer, null);
  const [elapsed, setElapsed] = useState(0);

  // 흐른 시간은 DB 에 남은 시작 시각에서 계산한다.
  // 브라우저를 닫았다 열어도, 다른 기기에서 봐도 같은 값이 나온다.
  useEffect(() => {
    if (!running) return;

    const tick = () => {
      const seconds = Math.max(
        0,
        Math.floor((Date.now() - new Date(running.startedAt).getTime()) / 1000),
      );
      setElapsed(seconds);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [running]);

  if (running) {
    return (
      <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-4">
        <p className="text-sm font-medium text-brand-700">공부하는 중</p>
        <p className="mt-1 truncate text-lg font-bold">{running.subject}</p>
        <p
          className="mt-2 font-mono text-3xl font-bold text-brand-600"
          aria-live="polite"
        >
          {formatElapsed(elapsed)}
        </p>

        <div className="mt-4 flex gap-2">
          <form action={stopTimer} className="flex-1">
            <input type="hidden" name="id" value={running.id} />
            <button type="submit" className={btnPrimary + " w-full"}>
              <Square className="size-4" aria-hidden />
              끝내고 기록
            </button>
          </form>
          <form
            action={cancelTimer}
            onSubmit={(event) => {
              if (!window.confirm("기록하지 않고 버릴까요?")) {
                event.preventDefault();
              }
            }}
          >
            <input type="hidden" name="id" value={running.id} />
            <button
              type="submit"
              aria-label="기록하지 않고 버리기"
              className={btnGhost}
            >
              <X className="size-4" aria-hidden />
              버리기
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="rounded-xl border border-line bg-surface p-4">
      <p className="mb-3 text-base font-bold">타이머 시작</p>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink-700">과목</span>
          <input
            name="subject"
            required
            list="study-subjects"
            placeholder="인적성 / 전공 / 자소서"
            className={inputClass + " h-11"}
          />
          <datalist id="study-subjects">
            {subjects.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>

        {milestones.length > 0 ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-700">
              연결할 마일스톤
            </span>
            <select
              name="milestone_id"
              className={inputClass + " h-11"}
              defaultValue=""
            >
              <option value="">연결 안 함</option>
              {milestones.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-ink-400">
              연결하면 로드맵 진행률에 자동으로 더해집니다.
            </span>
          </label>
        ) : null}
      </div>

      {state && !state.ok ? (
        <p className="mt-3 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className={btnPrimary + " mt-4 w-full"}
      >
        <Play className="size-4" aria-hidden />
        {pending ? "시작하는 중..." : "시작"}
      </button>
    </form>
  );
}
