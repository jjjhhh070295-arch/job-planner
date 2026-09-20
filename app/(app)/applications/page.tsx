import { ComingSoon, PageShell } from "@/components/page-shell";

export default function ApplicationsPage() {
  return (
    <PageShell
      title="지원 현황"
      description="전형 단계별로 지원한 곳을 관리합니다."
    >
      <ComingSoon
        items={[
          "단계별 칸반 (작성 중 → 제출 → 서류 합격 → 면접 → 최종)",
          "표 보기 전환",
          "기업 상세: 공고·일정 / 자소서 / 면접 복기 / 기업분석",
        ]}
      />
    </PageShell>
  );
}
