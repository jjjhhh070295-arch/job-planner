"use server";

import { revalidatePath } from "next/cache";

import { getCurrentProfile } from "@/lib/auth/current-user";
import type { FormState } from "@/lib/form-state";
import { sendNotification } from "@/lib/notify";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("로그인이 필요합니다.");
  const supabase = await createClient();
  return { supabase, userId: profile.userId };
}

function bool(formData: FormData, key: string): boolean {
  return formData.get(key) === "on";
}

export async function saveNotificationSettings(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, userId } = await requireUser();

  const morningRaw = String(formData.get("morning_time") ?? "").trim();
  const morningTime =
    morningRaw && /^\d{2}:\d{2}$/.test(morningRaw) ? `${morningRaw}:00` : null;

  const daysRaw = String(formData.get("deadline_days") ?? "").trim();
  const days = daysRaw ? Number.parseInt(daysRaw, 10) : 3;
  if (Number.isNaN(days) || days < 0 || days > 30) {
    return { ok: false, message: "마감 알림은 0~30일 사이로 넣어 주세요." };
  }

  const { error } = await supabase.from("notification_settings").upsert(
    {
      user_id: userId,
      push_on: bool(formData, "push_on"),
      morning_time: morningTime,
      morning_on: bool(formData, "morning_on"),
      deadline_on: bool(formData, "deadline_on"),
      event_on: bool(formData, "event_on"),
      task_on: bool(formData, "task_on"),
      deadline_days: days,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("[notifications] 설정 저장 실패", error.message);
    return { ok: false, message: "저장하지 못했습니다." };
  }

  revalidatePath("/settings/notifications");
  return { ok: true, message: "저장했습니다." };
}

/** 브라우저가 만든 구독 정보를 기록한다. */
export async function saveSubscription(
  endpoint: string,
  keys: { p256dh: string; auth: string },
  deviceLabel: string,
): Promise<{ ok: boolean; message: string }> {
  const { supabase, userId } = await requireUser();

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return { ok: false, message: "구독 정보가 올바르지 않습니다." };
  }

  // 같은 기기에서 다시 켜면 endpoint 가 같으므로 덮어쓴다.
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint,
      keys,
      device_label: deviceLabel.slice(0, 60),
      fail_count: 0,
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    console.error("[notifications] 구독 저장 실패", error.message);
    return { ok: false, message: "이 기기를 등록하지 못했습니다." };
  }

  // 설정 행이 없으면 기본값으로 만들어 둔다.
  await supabase
    .from("notification_settings")
    .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });

  revalidatePath("/settings/notifications");
  return { ok: true, message: "이 기기에서 알림을 받습니다." };
}

export async function removeSubscription(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("잘못된 요청입니다.");

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("id", id);
  if (error) console.error("[notifications] 구독 삭제 실패", error.message);

  revalidatePath("/settings/notifications");
}

/** 지금 바로 한 번 보내 본다. 설정이 제대로 됐는지 확인용. */
export async function sendTestNotification(
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  const { userId } = await requireUser();

  const result = await sendNotification({
    userId,
    // 시각을 넣어 매번 다른 열쇠가 되게 한다. 테스트는 여러 번 눌러도 가야 한다.
    dedupeKey: `test:${Date.now()}`,
    title: "알림 테스트",
    body: "이렇게 도착합니다. 눌러 보세요.",
    url: "/",
  });

  const messages: Record<typeof result, string> = {
    sent: "보냈습니다. 잠시 뒤 알림이 뜹니다.",
    skipped: "이미 보낸 알림입니다.",
    "no-device": "등록된 기기가 없습니다. 위에서 먼저 알림을 켜 주세요.",
    "not-configured": "서버에 VAPID 키가 없습니다. 운영자에게 알려 주세요.",
  };

  return { ok: result === "sent", message: messages[result] };
}
