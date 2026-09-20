/** Supabase 프로젝트 설정의 Minimum password length 와 맞춰 둔 값 */
export const MIN_PASSWORD_LENGTH = 8;

export const PASSWORD_RULE_TEXT = `${MIN_PASSWORD_LENGTH}자 이상`;

export function isValidPassword(password: unknown): password is string {
  return typeof password === "string" && password.length >= MIN_PASSWORD_LENGTH;
}
