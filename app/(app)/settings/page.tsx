import Link from "next/link";
import { redirect } from "next/navigation";
import { BellRing } from "lucide-react";

import {
  DeleteAccountForm,
  DisplayNameForm,
  FeedbackForm,
} from "./settings-client";
import { PageShell } from "@/components/page-shell";
import { PrivacyNotice } from "@/components/privacy-notice";
import { Card, CardHeader } from "@/components/ui/primitives";
import { getCurrentProfile } from "@/lib/auth/current-user";

export default async function SettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <PageShell title="설정" description={`@${profile.username}`}>
      <Card>
        <CardHeader title="내 정보" />
        <DisplayNameForm current={profile.displayName} />
        <p className="mt-4 border-t border-line pt-3 text-sm text-ink-500">
          비밀번호는{" "}
          <Link
            href="/settings/password"
            className="font-medium text-brand-600 hover:underline"
          >
            비밀번호 변경
          </Link>{" "}
          에서 바꿀 수 있습니다.
        </p>
      </Card>

      <Card>
        <CardHeader title="알림" />
        <p className="mb-3 text-sm text-ink-500">
          아침 요약과 일정 알림을 켜고 끌 수 있습니다.
        </p>
        <Link
          href="/settings/notifications"
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-line px-4 text-sm font-medium text-ink-700 hover:bg-muted-50"
        >
          <BellRing className="size-4" aria-hidden />
          알림 설정 열기
        </Link>
      </Card>

      <Card>
        <CardHeader title="의견 보내기" />
        <p className="mb-3 text-sm text-ink-500">
          운영자에게 바로 전달됩니다. 답장은 따로 드리지 못하지만 전부 읽습니다.
        </p>
        <FeedbackForm />
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold">개인정보 안내</h2>
        <PrivacyNotice />
      </section>

      <Card className="border-danger-100">
        <CardHeader title="계정 삭제" />
        <p className="mb-3 text-sm text-ink-500">
          탈퇴하면 저장된 내용이 모두 사라집니다.
        </p>
        <DeleteAccountForm username={profile.username} />
      </Card>
    </PageShell>
  );
}
