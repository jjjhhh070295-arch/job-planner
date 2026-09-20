# 취업 플래너 — 프로젝트 명세

> 이 파일은 프로젝트 루트에 두는 작업 지침서입니다. Claude(Claude Code 포함)는 작업 전 이 문서를 기준으로 판단합니다.

## 1. 프로젝트 개요

취업 준비생을 위한 **일정 관리 + 취업 로드맵 수립·실행** 웹앱.
지원 현황, 자소서, 면접 복기, 스펙, 공부 기록을 한곳에서 관리하고, 목표 → 월간 마일스톤 → 주간 → 오늘 할 일로 이어지는 로드맵을 실행하도록 돕는다.

- 배포: Vercel (`xxx.vercel.app` 기본 도메인 사용, 커스텀 도메인 없음)
- 사용자: 공개 서비스가 아님. **운영자가 링크와 초대 코드를 공유한 사람만** 가입
- 운영자(개발자)는 바이브코딩 경험만 있는 초보. 설명은 쉽게, 한 번에 한 단계씩

## 2. 기술 스택

| 영역 | 선택 |
| --- | --- |
| 프레임워크 | Next.js (App Router) + TypeScript |
| UI | Tailwind CSS + shadcn/ui, 아이콘 lucide-react |
| DB·인증·파일 | Supabase (Postgres, Auth, Storage), 리전 Seoul |
| 로그인 | Google OAuth + 초대 코드 검증 |
| AI | Google Gemini API (Flash 계열, 무료 티어) |
| 배포 | Vercel |
| 알림(2차) | Web Push (PWA, `web-push` + VAPID), 선택적으로 Gmail 앱 비밀번호 + Nodemailer |
| 예약 작업(2차) | Supabase pg_cron + Edge Functions (Vercel 무료 Cron은 하루 1회 수준이라 정밀 알림 불가) |

## 3. 절대 규칙 (보안·데이터)

1. **모든 테이블에 RLS를 켠다.** 기본은 `user_id = auth.uid()`인 행만 읽기·쓰기. 예외는 아래 공유 규칙과 공용 테이블(`exams`)뿐
2. **API 키는 서버에서만.** Gemini·Supabase service role 키는 Vercel 환경변수에만 두고, `NEXT_PUBLIC_` 접두사를 붙이지 않는다. 브라우저 코드에서 절대 참조 금지
3. **Storage 버킷은 private.** 경로는 `/{user_id}/...`, 본인 폴더만 접근. 파일은 매번 짧은 만료의 signed URL로 보여준다
4. **민감 정보 필드는 만들지 않는다.** 주민번호, 주소, 연락처 등은 저장 대상이 아니다
5. **자소서·면접 답변 원문·경험 뱅크는 AI API로 보내지 않는다.** 무료 티어는 입력이 학습에 쓰일 수 있음. 이 데이터를 쓰는 AI 기능은 "프롬프트 복사" 방식(7장)으로 처리
6. AI 호출은 서버 함수 하나로 감싼다 (`lib/ai.ts`의 `callAI()`). 공급자 교체 시 이 파일만 수정. 사용자별 하루 호출 횟수 제한
7. 알림 발송도 함수 하나로 감싼다 (`lib/notify.ts`의 `sendNotification()`)
8. 삭제·마이그레이션처럼 되돌리기 어려운 작업은 실행 전 운영자에게 확인받는다

## 4. 화면 구조 (IA)

데스크톱: 좌측 사이드바 / 모바일: 하단 탭 5개. 어디서든 **빠른 추가(+)** 버튼 → 공고 붙여넣기 · 할 일 · 면접 기록 · 공부 기록

- **홈(대시보드)**: 목표 로드맵 카드(최종 목표, 월별 단계, 마일스톤 진행률), 이번 주 → 오늘 할 일, 마감 임박 D-day, 어학 유효기간 경고
- **캘린더**: 마감·면접·시험·개인 일정 통합
- **지원 현황**: 전형 단계별 칸반(작성 중 → 제출 → 서류 합격 → 면접 → 최종) + 표 보기 전환
  - 기업 상세 탭: 공고·일정 / 자소서 / 면접 복기 / 기업분석
- **라이브러리**: 전체 자소서·면접 질문 검색 (기업·직무·시즌·문항 유형·결과 필터 + 키워드)
- **프로필**: 기본 정보, 학력, 자격·어학, 경험 뱅크, 수상, 첨부(링크)

UX 원칙
- 상태 색은 앱 전체에서 한 의미로만: 마감 임박 빨강, 진행 중 파랑, 합격 초록, 탈락 회색
- 할 일 체크·면접 복기·공부 기록은 **모바일 우선**, 자소서 작성은 **데스크톱 우선**
- 첫 로그인 온보딩: 빈 화면 대신 "기존 이력서로 프로필 채우기" 안내
- 면접 복기는 "빠른 기록" 모드: 질문만 연속 입력, 답변·보완점은 나중에

## 5. 단계별 범위

### 1차 (MVP) — 친구에게 링크 공유 가능한 상태
- [ ] 구글 로그인 + 초대 코드 가입
- [ ] 프로필: 학력, 자격·어학, 경험 뱅크 (텍스트만, 첨부는 링크 저장)
- [ ] 지원 현황: 기업·직무·시즌·마감일·전형 단계, 칸반/표
- [ ] AI 공고 파싱: 공고 텍스트 붙여넣기 → 기업·직무·마감일·자소서 문항·글자 수·어학 요건 추출
- [ ] 자소서 저장 + 검색 (문항 유형은 Gemini가 **문항 텍스트만** 보고 자동 태깅)
- [ ] 목표 로드맵 + 할 일 (목표 → 마일스톤 → 주간·오늘)
- [ ] 캘린더
- [ ] 대시보드

### 2차 — 매일 쓰게 만들기
- [ ] 면접 복기 (회차 + 질문 단위, 꼬리질문 연결)
- [ ] 스펙 관리 강화: 어학 유효기간 D-day, 공용 시험 일정, 목표 자격증 접수 알림
- [ ] 자소서 프롬프트 만들기 (7장)
- [ ] 공부 기록: 앱 내 타이머 + 타 앱(열품타 등) **캡처 업로드 → Gemini로 시간 추출**
- [ ] 알림: 웹 푸시(아침 요약 + 일정 N분 전)
- [ ] 공유 권한 (자소서/면접 분리)
- [ ] 파일 업로드 (증명서 등, 3장 3번 규칙 준수)
- [ ] 기업분석 패널: DART + 네이버 뉴스

### 3차 — 확장
- [ ] 채용공고 API (사람인·고용24, 승인되는 대로)
- [ ] 잡코리아 공채 달력 임베드
- [ ] 이메일 알림, 구글 캘린더 연동 (.ics 내보내기 먼저)
- [ ] 의미 기반 자소서 검색 (벡터)
- [ ] 친구끼리 공부 현황 보기

## 6. 데이터 모델 (초안)

모든 테이블: `id uuid pk`, `user_id uuid → auth.users`, `created_at`, `updated_at` (공용 테이블 제외). 구체 컬럼은 구현 시 조정 가능.

```
profiles           user_id, display_name, target_roles, target_industries
invite_codes       code, max_uses, used_count, expires_at          -- 운영자 관리
education          school, major, degree, start, end, gpa, key_courses
experiences        title, org, period_start, period_end, role,
                   situation, action, result, tags[]               -- 경험 뱅크
awards             title, org, date, description
attachments        kind(link|file), label, url_or_path             -- 1차는 link만

applications       company, role, season, status, deadline, posting_url,
                   posting_text, requirements(jsonb)
essays             application_id, question, char_limit, category,
                   answer, is_final
interviews         application_id, stage, type, date, format,
                   interviewer_count, atmosphere, overall_review, result
interview_questions interview_id, question, my_answer, improvement,
                   category, parent_id(꼬리질문)

exams              name, category, round, reg_start, reg_end,
                   exam_date, result_date                          -- 공용, 운영자만 쓰기
user_specs         name, category, status, score_or_grade,
                   acquired_date, expiry_date, target_exam_id

goals              title, due_date
milestones         goal_id, title, month, target_value,
                   auto_source(applications|tasks|experiences|specs|study|manual),
                   auto_filter(jsonb)
tasks              milestone_id, title, due_date, week_of, is_today,
                   done, repeat_rule
events             title, start_at, end_at, remind_before_min

study_sessions     subject, started_at, ended_at, source(timer|capture|manual),
                   capture_path, task_id, milestone_id, memo

shares             owner_id, grantee_id, application_id(null=전체),
                   scope(essays|interviews|both)
notification_settings  morning_time, push_on, email_on, kinds(jsonb)
push_subscriptions endpoint, keys(jsonb), device_label
```

검색: `pg_trgm` 확장으로 `essays.answer`, `essays.question`, `interview_questions.question`에 trigram 인덱스 (한국어는 기본 전문검색보다 부분 일치가 잘 맞음)

공유 RLS 개념 (essays 예시):
```sql
create policy "read own or shared" on essays for select using (
  user_id = auth.uid()
  or exists (
    select 1 from shares s
    where s.owner_id = essays.user_id
      and s.grantee_id = auth.uid()
      and s.scope in ('essays', 'both')
      and (s.application_id is null or s.application_id = essays.application_id)
  )
);
```
쓰기·수정·삭제는 본인만. 프로필·첨부·공부 기록은 공유 대상에서 제외.

마일스톤 자동 집계 예: "서류 15곳 제출" = `applications`에서 status가 제출 이상인 건수, "인적성 20시간" = `study_sessions` 합계.

## 7. AI 사용 정책

| 기능 | 방식 | 보내는 데이터 |
| --- | --- | --- |
| 공고 파싱 | Gemini API (무료) | 공고 텍스트 (공개 정보) |
| 문항·질문 유형 태깅 | Gemini API (무료) | 문항/질문 텍스트만 |
| 공부 캡처 시간 추출 | Gemini API (무료) | 타이머 앱 캡처 이미지 |
| 자소서 초안 | **프롬프트 복사** → 사용자가 각자 AI 채팅에서 생성 | API 전송 없음 |
| 프로필 일괄 입력 | **프롬프트 복사** → AI 채팅이 JSON 반환 → 붙여넣기 | API 전송 없음 |
| 로드맵 초안 | **프롬프트 복사** | API 전송 없음 |

프롬프트 복사 규칙
- 앱이 문항, 글자 수, 기업·직무, 선택한 경험, 참고 자소서, 규칙을 조립해 클립보드로 복사
- 규칙 문구에 반드시 포함: "제공한 경험에 없는 사실·수치는 쓰지 말 것", 글자 수 준수
- 결과는 "초안"으로만 저장. 사용한 경험을 출처로 표시

AI 응답은 JSON만 반환하도록 지시하고, 파싱 실패 시 사용자에게 수정 입력 화면을 보여준다.

## 8. 외부 API

| API | 용도 | 단계 |
| --- | --- | --- |
| Gemini (Google AI Studio) | 파싱·태깅·이미지 추출 | 1차 |
| DART 오픈API | 기업개황·재무 | 2차 |
| 네이버 검색 API(뉴스) | 기업 최신 뉴스 | 2차 |
| 공공데이터포털 국가자격 시험일정 | exams 자동 채우기 | 2차 |
| 공공데이터포털 특일정보 | 공휴일 | 2차 |
| 사람인 오픈API | 채용공고 검색 (승인 필요, 출처 표기 필수) | 3차 |
| 고용24 채용정보 | 채용공고 | 3차 |
| 한국은행 ECOS | 금리·환율 지표 (선택) | 3차 |

SQLD·ADsP, 토익·오픽, 금융자격 일정은 API가 없어 운영자가 `exams`에 직접 입력.
크롤링(자소설닷컴 등)은 하지 않는다.

## 9. 환경변수

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # 서버 전용
GEMINI_API_KEY=                   # 서버 전용
AI_DAILY_LIMIT_PER_USER=30
# 2차
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=                # 서버 전용
DART_API_KEY=
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
```
`.env.local`은 `.gitignore`에 반드시 포함.

## 10. 작업 방식 (Claude에게)

- 한 번에 한 기능. 각 단계 끝에 **운영자가 직접 확인할 방법**(어느 화면에서 무엇을 눌러 보면 되는지)을 알려준다
- 명령어는 복사해서 그대로 실행할 수 있게, 무엇을 하는 명령인지 한 줄 설명을 붙인다
- DB 변경은 `supabase/migrations/` 아래 SQL 파일로 남긴다 (Supabase SQL Editor에 붙여넣어 실행 가능해야 함)
- 새 테이블을 만들 때마다 RLS 정책을 같은 파일에 포함
- 막히면 에러 메시지 전문을 요청하고, 추측으로 여러 곳을 한꺼번에 고치지 않는다
- 커밋 단위는 기능 단위, 메시지는 한국어로

## 11. 시작 전 준비 체크리스트

- [ ] Node.js LTS 설치
- [ ] GitHub 계정
- [ ] Vercel 계정 (GitHub로 가입)
- [ ] Supabase 계정 + 새 프로젝트 (리전 Seoul)
- [ ] Google AI Studio에서 Gemini API 키 발급
- [ ] (2차 전) DART·네이버·공공데이터포털 키, 사람인 API 이용신청

## 12. 1차 진행 순서

1. Next.js 프로젝트 생성 → GitHub 저장소 연결
2. 빈 화면 그대로 Vercel 첫 배포 (배포 경로부터 뚫기)
3. Supabase 연결 + 구글 로그인 + 초대 코드
4. 레이아웃: 사이드바/하단 탭, 빈 페이지 5개
5. 프로필 → 지원 현황 → AI 공고 파싱 → 자소서·검색 → 로드맵·할 일 → 캘린더 → 대시보드 순으로 기능 추가
6. 매 기능 완료 시 Vercel 재배포 후 확인
