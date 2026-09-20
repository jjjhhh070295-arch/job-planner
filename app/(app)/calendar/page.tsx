import { ComingSoon, PageShell } from "@/components/page-shell";

export default function CalendarPage() {
  return (
    <PageShell
      title="캘린더"
      description="마감, 면접, 시험, 개인 일정을 한 화면에서 봅니다."
    >
      <ComingSoon
        items={[
          "월간 달력에 지원 마감일 표시",
          "면접 일정",
          "자격증 시험 접수일과 시험일",
          "직접 추가한 개인 일정",
        ]}
      />
    </PageShell>
  );
}
