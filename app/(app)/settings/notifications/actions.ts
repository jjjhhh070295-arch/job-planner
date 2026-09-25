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

/**
 * 브라우저가 만든 구독 정보를 기록한다.
 *
 * 여기서 오류를 던지면 배포본에서는 "An error occurred..." 같은 뭉뚱그린 문구만
 * 브라우저에 도착해서 원인을 알 수 없다. 그래서 전부 붙잡아 이유를 담아 돌려준다.
 */
export async function saveSubscription(
  endpoint: string,
  keys: { p256dh: string; auth: string },
  deviceLabel: string,
): Promise<{ ok: boolean; message: string; saved?: number }> {
  try {
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return {
        ok: false,
        message: "브라우저가 준 구독 정보가 비어 있습니다.",
      };
    }

    const profile = await getCurrentProfile();
    if (!profile) {
      return {
        ok: false,
        message:
          "로그인이 풀렸습니다. 새로고침해서 다시 로그인한 뒤 눌러 주세요.",
      };
    }

    const supabase = await createClient();
    const userId = profile.userId;

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
      console.error("[notifications] 구독 저장 실패", error.code, error.message);
      return {
        ok: false,
        message: `DB 저장 거절 (${error.code ?? "코드없음"}): ${error.message}`,
      };
    }

    // 설정 행이 없으면 기본값으로 만들어 둔다.
    await supabase
      .from("notification_settings")
      .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });

    // 진짜로 들어갔는지 다시 세어 본다. 저장된 줄 알았는데 없는 경우를 걸러낸다.
    const { count } = await supabase
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if (!count) {
      return {
        ok: false,
        message:
          "저장 요청은 통과했는데 기기 목록에 남지 않았습니다. 권한(RLS) 문제일 수 있습니다.",
      };
    }

    revalidatePath("/settings/notifications");
    return {
      ok: true,
      message: "이 기기에서 알림을 받습니다.",
      saved: count,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("[notifications] 구독 저장 중 예외", detail);
    return { ok: false, message: `서버 오류: ${detail}` };
  }
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
