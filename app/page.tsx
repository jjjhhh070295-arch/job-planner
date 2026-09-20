import { redirect } from "next/navigation";

import { LogoutButton } from "@/app/logout-button";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();

  // proxy.ts 에서 한 번 걸러내지만, 데이터에 가까운 곳에서 한 번 더 확인한다.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // RLS 덕분에 자기 행만 조회된다. 남의 프로필은 조건을 바꿔도 안 나온다.
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name")
    .eq("user_id", user.id)
    .single();

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <p className="text-lg font-bold">
            {profile?.display_name ?? "이름 없음"}
          </p>
          <p className="text-sm text-gray-500">@{profile?.username}</p>
        </div>
        <LogoutButton />
      </header>

      <section>
        <h1 className="text-xl font-bold">로그인 성공</h1>
        <p className="mt-2 text-sm text-gray-500">
          여기가 앞으로 대시보드가 될 자리입니다. 다음 단계에서 사이드바와 각
          화면을 붙입니다.
        </p>
      </section>
    </main>
  );
}
