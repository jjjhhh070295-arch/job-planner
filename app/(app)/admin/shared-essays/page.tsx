import { notFound, redirect } from "next/navigation";

import { AdminSharedEssayRow, type SharedEssayRow } from "./essay-row";
import { SharedEssayImportForm } from "./import-form";
import { PageShell } from "@/components/page-shell";
import {
  Card,
  CardHeader,
  EmptyState,
  StatCard,
  StatGrid,
} from "@/components/ui/primitives";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { createAdminClient, isAdminUsername } from "@/lib/supabase/admin";

/**
 * 공용 자소서 관리.
 *
 * 앱을 쓰지 않는 사람들이 운영자에게 준 자소서를 모아 두는 곳이다.
 * shared_essays 는 쓰기 정책이 없어서 service_role 로만 읽고 쓴다.
 * 그래서 화면에 들어오기 전에 관리자인지 먼저 확인한다.
 */
export default async function AdminSharedEssaysPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  // 403 은 주소가 있다는 사실을 알려 준다. 없는 화면처럼 둔다.
  if (!isAdminUsername(profile.username)) notFound();

  const admin = createAdminClient();
  const { data } = await admin
    .from("shared_essays")
    .select("*")
    .order("created_at", { ascending: false });

  const essays = (data ?? []) as SharedEssayRow[];
  const openCount = essays.filter((e) => e.visibility === "all").length;
  const companies = new Set(essays.map((e) => e.company)).size;

  return (
    <PageShell
      eyebrow="관리자"
      title="공용 자소서"
      description="받은 자소서를 문항 단위로 모아 둡니다. 전체 공개한 것만 사용자에게 보입니다."
    >
      <StatGrid columns={3}>
        <StatCard label="전체 문항" value={essays.length} unit="개" />
        <StatCard
          label="전체 공개"
          value={openCount}
          unit="개"
          tone="success"
          hint={`운영자만 ${essays.length - openCount}개`}
        />
        <StatCard label="기업 수" value={companies} unit="곳" tone="muted" />
      </StatGrid>

      <SharedEssayImportForm />

      <Card>
        <CardHeader title="등록된 공용 자소서" count={essays.length} />
        {essays.length === 0 ? (
          <EmptyState text="아직 없습니다. 위에서 붙여넣거나 파일을 올려 주세요." />
        ) : (
          <ul className="flex flex-col gap-2">
            {essays.map((essay) => (
              <AdminSharedEssayRow key={essay.id} essay={essay} />
            ))}
          </ul>
        )}
      </Card>
    </PageShell>
  );
}
