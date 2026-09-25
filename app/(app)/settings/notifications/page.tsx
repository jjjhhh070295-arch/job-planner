import { redirect } from "next/navigation";
import { Smartphone } from "lucide-react";

import { removeSubscription } from "./actions";
import { PushToggle } from "./push-toggle";
import {
  NotificationSettingsForm,
  type Settings,
} from "./settings-form";
import { DeleteRowButton } from "@/components/delete-row-button";
import { PageShell } from "@/components/page-shell";
import { Card, CardHeader, EmptyState } from "@/components/ui/primitives";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { formatDeadline } from "@/lib/date";
import { pushReady, vapidPublicKey } from "@/lib/notify";
import { createClient } from "@/lib/supabase/server";

const DEFAULTS: Settings = {
  push_on: true,
  morning_time: "08:00:00",
  morning_on: true,
  deadline_on: true,
  event_on: true,
  task_on: true,
  deadline_days: 3,
};

export default async function NotificationSettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();

  const [settingsResult, deviceResult] = await Promise.all([
    supabase
      .from("notification_settings")
      .select("*")
      .eq("user_id", profile.userId)
      .maybeSingle(),
    supabase
      .from("push_subscriptions")
      .select("id, device_label, last_sent_at, created_at")
      .eq("user_id", profile.userId)
      .order("created_at"),
  ]);

  const settings = (settingsResult.data as Settings | null) ?? DEFAULTS;
  const devices = deviceResult.data ?? [];

  return (
    <PageShell
      title="알림"
      description="아침 요약과 일정 알림을 받습니다."
    >
      {!pushReady() ? (
        <p className="rounded-xl bg-danger-50 px-4 py-3 text-sm text-danger-700">
          서버에 VAPID 키가 설정되지 않아 알림을 보낼 수 없습니다. 운영자에게
          알려 주세요.
        </p>
      ) : null}

      <Card>
        <CardHeader title="이 기기에서 알림 받기" />
        <div className="flex gap-2 rounded-lg bg-brand-50 px-3 py-2.5 text-sm text-brand-700">
          <Smartphone className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <strong>아이폰은 홈 화면에 추가해야 알림이 옵니다.</strong> 사파리
            공유 버튼 → 홈 화면에 추가 → 그 아이콘으로 연 뒤 알림을 켜 주세요.
            안드로이드·PC 는 바로 켤 수 있습니다.
          </span>
        </div>

        <div className="mt-3">
          <PushToggle vapidPublicKey={vapidPublicKey()} />
        </div>

        <div className="mt-4 border-t border-line pt-3">
          <p className="mb-2 text-sm font-medium text-ink-700">
            등록된 기기 {devices.length}개
          </p>
          {devices.length === 0 ? (
            <p className="text-sm text-ink-400">
              아직 없습니다. 위 버튼으로 이 기기를 등록하세요.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {devices.map((row) => {
                const device = row as {
                  id: string;
                  device_label: string | null;
                  last_sent_at: string | null;
                };
                return (
                  <li
                    key={device.id}
                    className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">
                        {device.device_label ?? "알 수 없는 기기"}
                      </span>
                      <span className="block text-xs text-ink-400">
                        {device.last_sent_at
                          ? `마지막 알림 ${formatDeadline(device.last_sent_at)}`
                          : "아직 받은 알림 없음"}
                      </span>
                    </span>
                    <DeleteRowButton
                      action={removeSubscription}
                      id={device.id}
                      label={device.device_label ?? "이 기기"}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="무엇을 받을까요" />
        {devices.length === 0 ? (
          <div className="mb-4">
            <EmptyState text="기기를 먼저 등록해야 알림이 갑니다. 설정은 미리 해 두셔도 됩니다." />
          </div>
        ) : null}
        <NotificationSettingsForm settings={settings} />
      </Card>

      <p className="text-center text-xs text-ink-400">
        알림은 정해진 시각에 서버가 보냅니다. 앱을 열어 두지 않아도 됩니다.
      </p>
    </PageShell>
  );
}
