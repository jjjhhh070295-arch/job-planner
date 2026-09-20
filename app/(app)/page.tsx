import { ComingSoon, PageShell } from "@/components/page-shell";
import { getCurrentProfile } from "@/lib/auth/current-user";

export default async function HomePage() {
  // 레이아웃에서 이미 걸러내지만, 데이터에 가까운 곳에서 한 번 더 확인한다.
  const profile = await getCurrentProfile();

  return (
    <PageShell
      title={`${profile?.displayName ?? ""} 님, 오늘도 화이팅`}
      description="목표 로드맵과 오늘 할 일이 여기에 모입니다."
    >
      <ComingSoon
        items={[
          "목표 로드맵 카드 (최종 목표, 월별 단계, 마일스톤 진행률)",
          "이번 주 → 오늘 할 일",
          "마감 임박 D-day",
          "어학 유효기간 경고",
        ]}
      />
    </PageShell>
  );
}
