import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { BottomTabs } from "@/components/bottom-tabs";
import { QuickAdd } from "@/components/quick-add";
import { Sidebar } from "@/components/sidebar";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { isAdminUsername } from "@/lib/supabase/admin";

/**
 * 로그인한 사람만 보는 화면들의 공통 껍데기.
 * 데스크톱은 왼쪽 사이드바, 모바일은 하단 탭 5개. (CLAUDE.md 4장)
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }

  // 임시 비밀번호 상태면 비밀번호부터 바꾸게 한다.
  // 이 검사를 레이아웃에 두면 아래 모든 화면이 한꺼번에 보호된다.
  if (profile.mustChangePassword) {
    redirect("/settings/password");
  }

  const isAdmin = isAdminUsername(profile.username);

  return (
    <div className="flex min-h-full flex-1">
      <Sidebar
        displayName={profile.displayName}
        username={profile.username}
        isAdmin={isAdmin}
      />

      {/*
        min-w-0 이 없으면 표처럼 넓은 자식이 이 칸을 밀어내 화면 전체에
        가로 스크롤이 생긴다. 모바일에서 특히 잘 드러난다.
        아래 여백은 하단 탭(56px) + 홈바 안전 영역.
      */}
      <div className="flex min-w-0 flex-1 flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:pb-0">
        {children}
      </div>

      <BottomTabs />
      <QuickAdd />
    </div>
  );
}
