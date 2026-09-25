/**
 * 가입 화면과 설정 화면이 같은 문구를 쓴다.
 * 내용이 달라지면 둘 중 한쪽만 고쳐져 어긋나기 쉬우므로 한곳에 둔다.
 */
export function PrivacyNotice() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 text-sm text-ink-700">
      <div>
        <p className="font-bold">무엇을 저장하나요</p>
        <p className="mt-1 text-ink-500">
          아이디, 표시 이름, 그리고 직접 입력하신 학력·자격·어학·경험, 지원 현황,
          자소서, 목표와 할 일, 일정입니다.
        </p>
      </div>

      <div>
        <p className="font-bold">저장하지 않는 것</p>
        <p className="mt-1 text-ink-500">
          주민등록번호, 주소, 연락처는 받지도 저장하지도 않습니다. 실제 이메일
          주소도 받지 않습니다 — 로그인용으로 아이디를 쓰고, 내부적으로만
          <span className="font-mono"> 아이디@job-planner.local </span>
          형태의 가짜 주소를 만듭니다. 그래서 이 앱은 여러분에게 메일을 보낼 수
          없습니다.
        </p>
      </div>

      <div>
        <p className="font-bold">첨부 파일</p>
        <p className="mt-1 text-ink-500">
          증명서 같은 파일을 올릴 수 있습니다. 비공개 보관함에 들어가고, 볼
          때마다 1분짜리 임시 링크를 새로 만듭니다.{" "}
          <strong className="text-ink-900">
            첨부는 다른 사람에게 공유되지 않습니다.
          </strong>{" "}
          주민등록번호처럼 민감한 부분은 가리고 올려 주세요.
        </p>
      </div>

      <div>
        <p className="font-bold">AI에 보내는 것</p>
        <p className="mt-1 text-ink-500">
          붙여넣은 <strong>채용공고 글</strong>, 자소서{" "}
          <strong>문항(질문) 문장</strong>, 공부 시간{" "}
          <strong>캡처 이미지</strong>만 Google Gemini로 보냅니다.
        </p>
        <p className="mt-1 text-ink-500">
          <strong className="text-ink-900">
            자소서 답변 원문, 면접 답변, 경험 뱅크 내용은 AI로 보내지 않습니다.
          </strong>{" "}
          이 내용을 쓰는 AI 기능은 대신 &ldquo;프롬프트 복사&rdquo; 방식으로
          만들어, 여러분이 직접 쓰는 AI 채팅에 붙여넣도록 합니다.
        </p>
      </div>

      <div>
        <p className="font-bold">운영자 접근</p>
        <p className="mt-1 text-ink-500">
          이 앱은 개인이 운영합니다. 운영자는 데이터베이스 관리자 권한을 가지고
          있어 <strong>기술적으로는 저장된 내용을 볼 수 있습니다.</strong> 다만
          비밀번호는 되돌릴 수 없는 형태로 저장되어 운영자도 알 수 없습니다.
        </p>
      </div>

      <div>
        <p className="font-bold">탈퇴</p>
        <p className="mt-1 text-ink-500">
          설정 화면에서 언제든 탈퇴할 수 있고, 탈퇴하면 위 내용이 모두
          삭제됩니다. 되돌릴 수 없습니다.
        </p>
      </div>
    </div>
  );
}
