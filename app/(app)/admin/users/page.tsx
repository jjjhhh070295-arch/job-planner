import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { UserList } from "./user-list";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { createAdminClient, isAdminUsername } from "@/lib/supabase/admin";

export default async function AdminUsersPage() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }

  // 관리자가 아니면 이런 주소가 있다는 것도 알리지 않는다.
  if (!isAdminUsername(profile.username)) {
    notFound();
  }

  // RLS 때문에 일반 클라이언트로는 남의 프로필이 안 보인다. 관리자 클라이언트로 읽는다.
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("username, display_name, must_change_password")
    .order("created_at");

  const users = (data ?? []).map((row) => ({
    username: row.username as string,
    displayName: row.display_name as string,
    mustChangePassword: row.must_change_password as boolean,
  }));

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-6">
      <h1 className="text-2xl font-bold">사용자 관리</h1>
      <p className="mt-1 text-sm text-gray-500">
        비밀번호를 잊은 사람에게 임시 비밀번호를 발급합니다. 이 앱의 계정은
        메일을 받을 수 없어서, 이것이 유일한 복구 수단입니다.
      </p>

      <div className="mt-8">
        <UserList users={users} />
      </div>

      <p className="mt-8 text-sm text-gray-500">
        <Link href="/" className="font-medium text-blue-600 hover:underline">
          홈으로
        </Link>
      </p>
    </main>
  );
}
