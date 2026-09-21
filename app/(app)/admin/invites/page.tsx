import { notFound, redirect } from "next/navigation";

import { createInviteCode } from "./actions";
import { InviteList, type InviteRow } from "./invite-list";
import { PageShell } from "@/components/page-shell";
import { RecordForm, type Field } from "@/components/record-form";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { formatDeadline } from "@/lib/date";
import { createAdminClient, isAdminUsername } from "@/lib/supabase/admin";

const FIELDS: Field[] = [
  {
    name: "max_uses",
    label: "사용 횟수",
    type: "number",
    placeholder: "1",
    hint: "1이면 한 사람만 쓸 수 있습니다",
  },
  {
    name: "valid_days",
    label: "유효기간 (일)",
    type: "number",
    placeholder: "30",
    hint: "비우면 기간 제한 없음",
  },
  {
    name: "memo",
    label: "메모",
    placeholder: "동아리 친구들",
    wide: true,
  },
];

export default async function AdminInvitesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!isAdminUsername(profile.username)) notFound();

  const admin = createAdminClient();

  const [codeResult, userResult] = await Promise.all([
    admin
      .from("invite_codes")
      .select("id, code, max_uses, used_count, expires_at, memo")
      .order("created_at", { ascending: false }),
    admin
      .from("profiles")
      .select("display_name, username, used_invite_code")
      .not("used_invite_code", "is", null),
  ]);

  // 코드별로 누가 가입했는지 모은다.
  const usersByCode = new Map<string, string[]>();
  for (const row of userResult.data ?? []) {
    const r = row as {
      display_name: string;
      username: string;
      used_invite_code: string;
    };
    const list = usersByCode.get(r.used_invite_code) ?? [];
    list.push(`${r.display_name}(@${r.username})`);
    usersByCode.set(r.used_invite_code, list);
  }

  const now = Date.now();
  const items: InviteRow[] = (codeResult.data ?? []).map((row) => {
    const r = row as {
      id: string;
      code: string;
      max_uses: number;
      used_count: number;
      expires_at: string | null;
      memo: string | null;
    };
    return {
      id: r.id,
      code: r.code,
      maxUses: r.max_uses,
      usedCount: r.used_count,
      expiresAt: r.expires_at,
      expiresText: r.expires_at ? formatDeadline(r.expires_at) : null,
      expired: r.expires_at !== null && new Date(r.expires_at).getTime() <= now,
      memo: r.memo,
      users: usersByCode.get(r.code) ?? [],
    };
  });

  const usable = items.filter(
    (item) => !item.expired && item.usedCount < item.maxUses,
  ).length;

  return (
    <PageShell
      title="초대 코드"
      description={`전체 ${items.length}개 · 지금 쓸 수 있는 코드 ${usable}개`}
    >
      <InviteList items={items} />
      <RecordForm
        action={createInviteCode}
        fields={FIELDS}
        openLabel="초대 코드 만들기"
        submitLabel="만들기"
      />
    </PageShell>
  );
}
