import "server-only";

import webpush from "web-push";

import { createAdminClient } from "@/lib/supabase/admin";

/* ============================================================
   알림 발송은 전부 이 파일을 거친다 (CLAUDE.md 3장 7번).
   공급자를 바꾸더라도 여기만 고치면 된다.
   ============================================================ */

export type NotificationKind = "morning" | "deadline" | "event" | "task";

export type NotificationInput = {
  userId: string;
  /** 같은 알림을 두 번 보내지 않기 위한 열쇠. 예: "morning:2026-09-25" */
  dedupeKey: string;
  title: string;
  body: string;
  /** 알림을 눌렀을 때 열 화면 */
  url: string;
};

let configured = false;

function configure(): boolean {
  if (configured) return true;

  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:admin@example.com";

  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export function pushReady(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY?.trim() && process.env.VAPID_PRIVATE_KEY?.trim(),
  );
}

export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY?.trim() || null;
}

/**
 * 알림 하나를 그 사람의 모든 기기로 보낸다.
 *
 * 이미 보낸 알림이면 아무것도 하지 않는다. 예약 실행이 5분마다 돌아도
 * 같은 마감 알림이 열두 번 가지 않도록 장부(notification_log)를 먼저 찍는다.
 */
export async function sendNotification(
  input: NotificationInput,
): Promise<"sent" | "skipped" | "no-device" | "not-configured"> {
  if (!configure()) return "not-configured";

  const admin = createAdminClient();

  // 장부를 먼저 찍는다. 이미 있으면 보낸 적이 있다는 뜻이다.
  // 보내고 나서 찍으면, 보내는 중에 다음 실행이 겹쳐 두 번 갈 수 있다.
  const { error: logError } = await admin
    .from("notification_log")
    .insert({ user_id: input.userId, dedupe_key: input.dedupeKey });

  if (logError) {
    if (logError.code === "23505") return "skipped"; // 이미 보냄
    console.error("[notify] 장부 기록 실패", logError.message);
    return "skipped";
  }

  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, keys")
    .eq("user_id", input.userId);

  // 보낼 기기가 없으면 장부를 다시 지운다.
  // 그대로 두면 "오늘 아침 요약은 보냈다" 로 남아서,
  // 오후에 기기를 등록해도 오늘 알림을 못 받게 된다.
  const rollback = async () => {
    await admin
      .from("notification_log")
      .delete()
      .eq("user_id", input.userId)
      .eq("dedupe_key", input.dedupeKey);
  };

  if (!subscriptions || subscriptions.length === 0) {
    await rollback();
    return "no-device";
  }

  const payload = JSON.stringify({
    title: input.title,
    body: input.body,
    url: input.url,
  });

  let delivered = 0;

  for (const row of subscriptions) {
    const sub = row as {
      id: string;
      endpoint: string;
      keys: { p256dh: string; auth: string };
    };

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        payload,
        { TTL: 60 * 60 * 6 },
      );
      delivered += 1;
      await admin
        .from("push_subscriptions")
        .update({ last_sent_at: new Date().toISOString(), fail_count: 0 })
        .eq("id", sub.id);
    } catch (error) {
      const status = (error as { statusCode?: number })?.statusCode;

      // 404/410 은 "이 구독은 이제 없다" 는 뜻이다. 바로 치운다.
      if (status === 404 || status === 410) {
        await admin.from("push_subscriptions").delete().eq("id", sub.id);
        continue;
      }

      console.error("[notify] 발송 실패", status ?? error);
      const { data: current } = await admin
        .from("push_subscriptions")
        .select("fail_count")
        .eq("id", sub.id)
        .maybeSingle();

      const next = ((current?.fail_count as number) ?? 0) + 1;
      if (next >= 5) {
        // 다섯 번 내리 실패하면 죽은 기기로 본다.
        await admin.from("push_subscriptions").delete().eq("id", sub.id);
      } else {
        await admin
          .from("push_subscriptions")
          .update({ fail_count: next })
          .eq("id", sub.id);
      }
    }
  }

  if (delivered === 0) {
    // 한 대도 못 받았으면 보낸 것이 아니다. 다음 실행에서 다시 시도한다.
    await rollback();
    return "no-device";
  }

  return "sent";
}
