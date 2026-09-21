import Link from "next/link";
import { redirect } from "next/navigation";

import { PasswordForm } from "./password-form";
import { getCurrentProfile } from "@/lib/auth/current-user";

export default async function PasswordSettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }

  return (
    <main className="mx-auto w-full max-w-sm flex-1 p-6">
      <h1 className="text-2xl font-bold">비밀번호 변경</h1>

      {profile.mustChangePassword ? (
        <p className="mt-4 rounded-md bg-muted-100 px-3 py-2 text-sm text-muted-600">
          관리자가 발급한 임시 비밀번호로 로그인했습니다. 새 비밀번호를 정해야
          다른 화면을 이용할 수 있습니다.
        </p>
      ) : (
        <p className="mt-1 text-sm text-ink-500">
          안전을 위해 기존 비밀번호를 함께 확인합니다.
        </p>
      )}

      <div className="mt-8">
        <PasswordForm forced={profile.mustChangePassword} />
      </div>

      {profile.mustChangePassword ? null : (
        <p className="mt-6 text-center text-sm text-ink-500">
          <Link href="/" className="font-medium text-brand-600 hover:underline">
            홈으로
          </Link>
        </p>
      )}
    </main>
  );
}
