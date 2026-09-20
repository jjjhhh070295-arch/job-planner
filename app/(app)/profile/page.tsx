import { ComingSoon, PageShell } from "@/components/page-shell";

export default function ProfilePage() {
  return (
    <PageShell
      title="프로필"
      description="자소서를 쓸 때 꺼내 쓸 재료를 모아 둡니다."
    >
      <ComingSoon
        items={[
          "학력",
          "자격증과 어학 점수 (유효기간 포함)",
          "경험 뱅크 (상황·행동·결과)",
          "수상 내역",
          "첨부 링크",
        ]}
      />
    </PageShell>
  );
}
