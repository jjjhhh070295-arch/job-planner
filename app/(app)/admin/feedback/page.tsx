import { notFound, redirect } from "next/navigation";

import { toggleFeedbackHandled } from "./actions";
import { PageShell } from "@/components/page-shell";
import { Tag, btnGhost } from "@/components/ui/primitives";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { formatDeadline } from "@/lib/date";
import { createAdminClient, isAdminUsername } from "@/lib/supabase/admin";

type Row = {
  id: string;
  message: string;
  page_path: string | null;
  handled: boolean;
  created_at: string;
  user_id: string;
};

export default async function AdminFeedbackPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!isAdminUsername(profile.username)) notFound();

  const admin = createAdminClient();

  // 피드백은 RLS 로 읽기를 막아 두었으므로 관리자 클라이언트로 읽는다.
  const [feedbackResult, profileResult] = await Promise.all([
    admin
      .from("feedback")
      .select("id, message, page_path, handled, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(200),
    admin.from("profiles").select("user_id, username, display_name"),
  ]);

  const nameByUser = new Map(
    (profileResult.data ?? []).map((row) => {
      const r = row as { user_id: string; username: string; display_name: string };
      return [r.user_id, `${r.display_name}(@${r.username})`];
    }),
  );

  const items = (feedbackResult.data ?? []) as Row[];
  const pending = items.filter((item) => !item.handled).length;

  return (
    <PageShell
      title="받은 의견"
      description={`전체 ${items.length}건 · 안 읽은 것 ${pending}건`}
    >
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-surface px-4 py-8 text-center text-sm text-ink-500">
          아직 들어온 의견이 없습니다.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-line bg-surface p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium">
                      {nameByUser.get(item.user_id) ?? "탈퇴한 사용자"}
                    </span>
                    {item.handled ? (
                      <Tag tone="muted">처리함</Tag>
                    ) : (
                      <Tag tone="brand">새 의견</Tag>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-400">
                    {formatDeadline(item.created_at)}
                    {item.page_path ? ` · ${item.page_path}` : ""}
                  </p>
                  <p className="mt-2 wrap-anywhere whitespace-pre-wrap text-sm text-ink-700">
                    {item.message}
                  </p>
                </div>

                <form action={toggleFeedbackHandled} className="shrink-0">
                  <input type="hidden" name="id" value={item.id} />
                  <input
                    type="hidden"
                    name="next"
                    value={String(!item.handled)}
                  />
                  <button type="submit" className={btnGhost + " px-3 text-xs"}>
                    {item.handled ? "되돌리기" : "처리함"}
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
