"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";

import { saveNotificationSettings, sendTestNotification } from "./actions";
import { btnGhost, btnPrimary, inputClass } from "@/components/ui/primitives";

export type Settings = {
  push_on: boolean;
  morning_time: string | null;
  morning_on: boolean;
  deadline_on: boolean;
  event_on: boolean;
  task_on: boolean;
  deadline_days: number;
};

function Row({
  name,
  label,
  description,
  defaultChecked,
}: {
  name: string;
  label: string;
  description: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-start gap-3 border-t border-line py-3 first:border-t-0 first:pt-0">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 size-5 shrink-0 accent-brand-600"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink-900">{label}</span>
        <span className="block text-xs text-ink-500">{description}</span>
      </span>
    </label>
  );
}

export function NotificationSettingsForm({ settings }: { settings: Settings }) {
  const [state, action, pending] = useActionState(
    saveNotificationSettings,
    null,
  );
  const [testState, testAction, testPending] = useActionState(
    sendTestNotification,
    null,
  );

  // "08:30:00" -> "08:30"
  const morning = settings.morning_time?.slice(0, 5) ?? "";

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-4">
        <div>
          <Row
            name="push_on"
            label="알림 전체 받기"
            description="이걸 끄면 아래 설정과 상관없이 아무 알림도 오지 않습니다."
            defaultChecked={settings.push_on}
          />
          <Row
            name="morning_on"
            label="아침 요약"
            description="오늘 할 일과 마감을 하루에 한 번 모아서 보냅니다."
            defaultChecked={settings.morning_on}
          />
          <Row
            name="deadline_on"
            label="지원 마감 알림"
            description="자소서 마감이 다가오면 알려 줍니다."
            defaultChecked={settings.deadline_on}
          />
          <Row
            name="event_on"
            label="일정 시작 전 알림"
            description="캘린더 일정에 적어 둔 시간만큼 앞서 알려 줍니다."
            defaultChecked={settings.event_on}
          />
          <Row
            name="task_on"
            label="할 일 마감 알림"
            description="오늘까지인 할 일이 남아 있으면 알려 줍니다."
            defaultChecked={settings.task_on}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 border-t border-line pt-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-700">
              아침 요약 받을 시각
            </span>
            <input
              type="time"
              name="morning_time"
              defaultValue={morning}
              className={inputClass + " h-11"}
            />
            <span className="text-xs text-ink-400">
              비우면 아침 요약을 받지 않습니다. 서울 시각 기준입니다.
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-700">
              마감 며칠 전에 알릴까요
            </span>
            <input
              type="number"
              inputMode="numeric"
              name="deadline_days"
              defaultValue={settings.deadline_days}
              min={0}
              max={30}
              className={inputClass + " h-11"}
            />
            <span className="text-xs text-ink-400">
              0이면 마감 당일에만 알립니다.
            </span>
          </label>
        </div>

        {state ? (
          <p
            className={
              "rounded-lg px-3 py-2 text-sm " +
              (state.ok
                ? "bg-success-50 text-success-700"
                : "bg-danger-50 text-danger-700")
            }
          >
            {state.message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className={btnPrimary + " self-start"}
        >
          {pending ? "저장 중..." : "저장"}
        </button>
      </form>

      <form action={testAction} className="border-t border-line pt-4">
        <button type="submit" disabled={testPending} className={btnGhost}>
          <Send className="size-4" aria-hidden />
          {testPending ? "보내는 중..." : "테스트 알림 보내기"}
        </button>

        {testState ? (
          <p
            className={
              "mt-2 rounded-lg px-3 py-2 text-sm " +
              (testState.ok
                ? "bg-success-50 text-success-700"
                : "bg-danger-50 text-danger-700")
            }
          >
            {testState.message}
          </p>
        ) : null}
      </form>
    </div>
  );
}
