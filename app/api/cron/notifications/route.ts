import { NextResponse } from "next/server";

import { isClosed } from "@/lib/application-status";
import {
  daysUntilTimestamp,
  formatDeadline,
  nowTimeInSeoul,
  todayInSeoul,
} from "@/lib/date";
import { sendNotification } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";

/* ============================================================
   예약 실행이 부르는 알림 발송 경로.

   Supabase 의 pg_cron 이 몇 분마다 이 주소를 부른다.
   (Vercel 무료 Cron 은 하루 한 번이라 정밀 알림이 안 된다 — CLAUDE.md 2장)

   같은 알림을 두 번 보내지 않는 것은 notification_log 가 맡는다.
   그래서 이 경로는 몇 번을 불러도 안전하다.
   ============================================================ */

/** 오늘까지인 할 일이 남았을 때 저녁에 한 번 찔러 주는 시각 (서울) */
const EVENING_NUDGE = "20:00";

type Settings = {
  user_id: string;
  push_on: boolean;
  morning_time: string | null;
  morning_on: boolean;
  deadline_on: boolean;
  event_on: boolean;
  task_on: boolean;
  deadline_days: number;
};

function unauthorized() {
  return NextResponse.json({ message: "권한이 없습니다." }, { status: 401 });
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.error("[cron] CRON_SECRET 이 없습니다.");
    return NextResponse.json(
      { message: "서버 설정이 되어 있지 않습니다." },
      { status: 500 },
    );
  }

  const header = request.headers.get("authorization") ?? "";
  if (header !== `Bearer ${secret}`) return unauthorized();

  const admin = createAdminClient();
  const today = todayInSeoul();
  const now = nowTimeInSeoul();
  const nowMs = Date.now();

  const { data: settingsData, error } = await admin
    .from("notification_settings")
    .select("*")
    .eq("push_on", true);

  if (error) {
    console.error("[cron] 설정 조회 실패", error.message);
    return NextResponse.json({ message: "설정을 읽지 못했습니다." }, { status: 500 });
  }

  const everyone = (settingsData ?? []) as Settings[];
  let sent = 0;
  let skipped = 0;

  const record = (result: string) => {
    if (result === "sent") sent += 1;
    else skipped += 1;
  };

  for (const settings of everyone) {
    const userId = settings.user_id;

    /* ---------------- 아침 요약 ---------------- */
    if (settings.morning_on && settings.morning_time) {
      const target = settings.morning_time.slice(0, 5);
      // 그 시각을 지났고 오늘 아직 안 보냈으면 보낸다.
      // 서버가 잠깐 멈춰 시각을 놓쳐도 다음 실행에서 따라잡는다.
      if (now >= target) {
        const [taskResult, appResult] = await Promise.all([
          admin
            .from("tasks")
            .select("id, title, due_date, is_today")
            .eq("user_id", userId)
            .eq("done", false),
          admin
            .from("applications")
            .select("id, company, status, deadline")
            .eq("user_id", userId)
            .not("deadline", "is", null),
        ]);

        const tasks = (taskResult.data ?? []) as {
          due_date: string | null;
          is_today: boolean;
        }[];
        const todayTasks = tasks.filter(
          (t) => t.is_today || t.due_date === today,
        ).length;

        const apps = (appResult.data ?? []) as {
          status: string;
          deadline: string;
        }[];
        const soon = apps.filter((a) => {
          if (isClosed(a.status)) return false;
          const days = daysUntilTimestamp(a.deadline);
          return days >= 0 && days <= 7;
        }).length;

        const parts: string[] = [];
        if (settings.task_on) parts.push(`오늘 할 일 ${todayTasks}개`);
        if (settings.deadline_on) parts.push(`이번 주 마감 ${soon}곳`);

        record(
          await sendNotification({
            userId,
            dedupeKey: `morning:${today}`,
            title: "오늘의 요약",
            body:
              parts.length > 0
                ? parts.join(" · ")
                : "오늘도 한 걸음. 앱에서 확인해 보세요.",
            url: "/",
          }),
        );
      }
    }

    /* ---------------- 지원 마감 ---------------- */
    if (settings.deadline_on) {
      const { data } = await admin
        .from("applications")
        .select("id, company, status, deadline")
        .eq("user_id", userId)
        .not("deadline", "is", null);

      for (const row of data ?? []) {
        const app = row as {
          id: string;
          company: string;
          status: string;
          deadline: string;
        };
        if (isClosed(app.status)) continue;

        const days = daysUntilTimestamp(app.deadline);
        // 설정한 날 전과 마감 당일, 두 번만 알린다.
        const shouldAlert = days === settings.deadline_days || days === 0;
        if (!shouldAlert) continue;

        record(
          await sendNotification({
            userId,
            dedupeKey: `deadline:${app.id}:${days}`,
            title:
              days === 0
                ? `오늘 마감 · ${app.company}`
                : `D-${days} · ${app.company}`,
            body: `${formatDeadline(app.deadline)} 마감입니다.`,
            url: `/applications/${app.id}`,
          }),
        );
      }
    }

    /* ---------------- 일정 시작 전 ---------------- */
    if (settings.event_on) {
      const { data } = await admin
        .from("events")
        .select("id, title, kind, start_at, remind_before_min")
        .eq("user_id", userId)
        .not("remind_before_min", "is", null)
        .gte("start_at", new Date(nowMs).toISOString());

      for (const row of data ?? []) {
        const event = row as {
          id: string;
          title: string;
          kind: string;
          start_at: string;
          remind_before_min: number;
        };

        const startMs = new Date(event.start_at).getTime();
        const alertMs = startMs - event.remind_before_min * 60_000;
        if (nowMs < alertMs) continue;

        record(
          await sendNotification({
            userId,
            dedupeKey: `event:${event.id}`,
            title: `${event.kind} · ${event.title}`,
            body: `${formatDeadline(event.start_at)} 에 시작합니다.`,
            url: "/calendar",
          }),
        );
      }
    }

    /* ---------------- 오늘 할 일 저녁 알림 ---------------- */
    if (settings.task_on && now >= EVENING_NUDGE) {
      const { data } = await admin
        .from("tasks")
        .select("id, title, due_date, is_today")
        .eq("user_id", userId)
        .eq("done", false);

      const remaining = (data ?? []).filter((row) => {
        const task = row as { due_date: string | null; is_today: boolean };
        return task.is_today || task.due_date === today;
      });

      if (remaining.length > 0) {
        record(
          await sendNotification({
            userId,
            dedupeKey: `task:${today}`,
            title: "오늘 할 일이 남았습니다",
            body: `${remaining.length}개가 아직 안 끝났어요.`,
            url: "/roadmap",
          }),
        );
      }
    }
  }

  return NextResponse.json({
    ok: true,
    checkedUsers: everyone.length,
    sent,
    skipped,
    at: `${today} ${now} (Asia/Seoul)`,
  });
}

/** 눌러서 확인해 볼 수 있게 GET 도 같은 일을 한다. */
export async function GET(request: Request) {
  return POST(request);
}

/** 언제나 그때그때 계산한다. 캐시되면 알림이 안 간다. */
export const dynamic = "force-dynamic";
