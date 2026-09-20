import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/app/logout-button";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { isAdminUsername } from "@/lib/supabase/admin";

export default async function HomePage() {
  // proxy.ts 에서 한 번 걸러내지만, 데이터에 가까운 곳에서 한 번 더 확인한다.
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }

  // 임시 비밀번호 상태면 비밀번호부터 바꾸게 한다.
  if (profile.mustChangePassword) {
    redirect("/settings/password");
  }

  const isAdmin = isAdminUsername(profile.username);

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <p className="text-lg font-bold">{profile.displayName}</p>
          <p className="text-sm text-gray-500">@{profile.username}</p>
        </div>
        <LogoutButton />
      </header>

      <section>
        <h1 className="text-xl font-bold">로그인 성공</h1>
        <p className="mt-2 text-sm text-gray-500">
          여기가 앞으로 대시보드가 될 자리입니다.
        </p>
      </section>

      <nav className="flex flex-col gap-2 text-sm">
        <Link
          href="/settings/password"
          className="font-medium text-blue-600 hover:underline"
        >
          비밀번호 변경
        </Link>
        {isAdmin ? (
          <Link
            href="/admin/users"
            className="font-medium text-blue-600 hover:underline"
          >
            사용자 관리 (관리자)
          </Link>
        ) : null}
      </nav>
    </main>
  );
}
