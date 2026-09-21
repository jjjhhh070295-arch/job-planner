import type { SupabaseClient } from "@supabase/supabase-js";

import type { Milestone, ProgressCounts } from "@/lib/roadmap";

export type Goal = {
  id: string;
  title: string;
  due_date: string | null;
};

export type Task = {
  id: string;
  milestone_id: string | null;
  title: string;
  due_date: string | null;
  week_of: string | null;
  is_today: boolean;
  done: boolean;
};

/**
 * 마일스톤 진행률을 계산하는 데 필요한 개수들을 한 번에 모은다.
 * RLS 때문에 전부 본인 것만 세어진다.
 */
export async function loadProgressCounts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
): Promise<ProgressCounts> {
  const [applications, experiences, specs, doneTasks] = await Promise.all([
    // "작성 중" 은 아직 제출한 게 아니므로 뺀다.
    supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .neq("status", "작성 중"),
    supabase.from("experiences").select("id", { count: "exact", head: true }),
    supabase
      .from("user_specs")
      .select("id", { count: "exact", head: true })
      .eq("status", "보유"),
    supabase.from("tasks").select("milestone_id").eq("done", true),
  ]);

  // 끝난 공부만 센다. 돌고 있는 타이머는 아직 시간이 확정되지 않았다.
  const studyResult = await supabase
    .from("study_sessions")
    .select("milestone_id, started_at, ended_at")
    .not("milestone_id", "is", null)
    .not("ended_at", "is", null);

  const studyMinutes = new Map<string, number>();
  for (const row of studyResult.data ?? []) {
    const r = row as {
      milestone_id: string | null;
      started_at: string;
      ended_at: string;
    };
    if (!r.milestone_id) continue;
    const minutes =
      (new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()) /
      60_000;
    studyMinutes.set(
      r.milestone_id,
      (studyMinutes.get(r.milestone_id) ?? 0) + minutes,
    );
  }

  const studyHoursByMilestone = new Map<string, number>();
  for (const [key, minutes] of studyMinutes) {
    studyHoursByMilestone.set(key, Math.floor(minutes / 60));
  }

  const doneTasksByMilestone = new Map<string, number>();
  for (const row of doneTasks.data ?? []) {
    const key = (row as { milestone_id: string | null }).milestone_id;
    if (!key) continue;
    doneTasksByMilestone.set(key, (doneTasksByMilestone.get(key) ?? 0) + 1);
  }

  return {
    applications: applications.count ?? 0,
    experiences: experiences.count ?? 0,
    specs: specs.count ?? 0,
    doneTasksByMilestone,
    studyHoursByMilestone,
  };
}

export type MilestoneRow = Milestone & { goal_id: string | null };
