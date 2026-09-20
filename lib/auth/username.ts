// 아이디(username) <-> 로그인용 가짜 이메일 변환 규칙.
// Supabase Auth 는 이메일만 받으므로, 아이디를 <아이디>@job-planner.local 로 바꿔 저장한다.
// 실제로 존재하지 않는 도메인이라 이 주소로는 메일이 가지 않는다.

export const USERNAME_DOMAIN = "job-planner.local";

/** 영문 소문자로 시작, 영문 소문자·숫자·밑줄, 3~20자. DB 의 CHECK 제약과 같은 규칙. */
export const USERNAME_PATTERN = /^[a-z][a-z0-9_]{2,19}$/;

export const USERNAME_RULE_TEXT =
  "영문 소문자로 시작, 영문·숫자·밑줄(_) 3~20자";

export const DISPLAY_NAME_RULE_TEXT = "1~20자 (한글 가능)";

/** 입력값의 앞뒤 공백을 없애고 소문자로 통일한다. 대문자로 쳐도 로그인되게 하기 위함. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username);
}

export function isValidDisplayName(displayName: string): boolean {
  const trimmed = displayName.trim();
  return trimmed.length >= 1 && trimmed.length <= 20;
}

export function usernameToEmail(username: string): string {
  return `${username}@${USERNAME_DOMAIN}`;
}

/** 초대 코드는 DB 에 대문자로 저장된다. 소문자로 입력해도 맞도록 변환한다. */
export function normalizeInviteCode(raw: string): string {
  return raw.trim().toUpperCase();
}
