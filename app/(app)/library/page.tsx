import { ComingSoon, PageShell } from "@/components/page-shell";

export default function LibraryPage() {
  return (
    <PageShell
      title="라이브러리"
      description="써 둔 자소서와 받았던 면접 질문을 한곳에서 찾습니다."
    >
      <ComingSoon
        items={[
          "자소서 전체 검색 (키워드 부분 일치)",
          "기업, 직무, 시즌, 문항 유형, 결과로 거르기",
          "면접 질문 검색",
        ]}
      />
    </PageShell>
  );
}
