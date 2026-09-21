import { notFound, redirect } from "next/navigation";

import { SyncButton } from "./sync-button";
import { syncDartCorps } from "./actions";
import { PageShell } from "@/components/page-shell";
import { Card, CardHeader } from "@/components/ui/primitives";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { formatDeadline } from "@/lib/date";
import { createAdminClient, isAdminUsername } from "@/lib/supabase/admin";

export default async function AdminDartPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!isAdminUsername(profile.username)) notFound();

  const admin = createAdminClient();

  const [{ count }, latest] = await Promise.all([
    admin.from("dart_corps").select("corp_code", { count: "exact", head: true }),
    admin
      .from("dart_corps")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const hasKey = Boolean(process.env.DART_API_KEY);

  return (
    <PageShell
      title="DART 기업 목록"
      description="기업분석에 쓸 고유번호 목록입니다."
    >
      <Card>
        <CardHeader title="현재 상태" />
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-500">DART 키</dt>
            <dd className={hasKey ? "text-success-700" : "text-danger-700"}>
              {hasKey ? "설정됨" : "없음"}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-500">저장된 상장사</dt>
            <dd className="font-medium">{(count ?? 0).toLocaleString()}개</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-500">마지막 갱신</dt>
            <dd className="text-ink-700">
              {latest.data?.updated_at
                ? formatDeadline(latest.data.updated_at as string)
                : "없음"}
            </dd>
          </div>
        </dl>
      </Card>

      <Card>
        <CardHeader title="목록 가져오기" />
        <p className="mb-3 text-sm text-ink-500">
          DART는 기업 이름으로 바로 조회할 수 없고 고유번호가 필요합니다. 고유번호
          목록은 zip 파일로만 제공돼서, 한 번 받아 두고 씁니다.{" "}
          <strong>상장사만</strong> 추려 담으므로 3천 건 안쪽입니다. 분기에 한 번
          정도 다시 받으면 충분합니다.
        </p>
        <SyncButton action={syncDartCorps} />
      </Card>
    </PageShell>
  );
}
