import { redirect } from "next/navigation";

import { ParseClient } from "./parse-client";
import { PageShell } from "@/components/page-shell";
import { aiDailyLimit, aiUsedToday } from "@/lib/ai";
import { getCurrentProfile } from "@/lib/auth/current-user";

export default async function ParsePostingPage() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }

  const used = await aiUsedToday(profile.userId);

  return (
    <PageShell
      title="공고 붙여넣기"
      description="공고 글을 붙여넣으면 기업·마감일·자소서 문항을 뽑아냅니다."
    >
      <ParseClient usedToday={used} limit={aiDailyLimit()} />
    </PageShell>
  );
}
