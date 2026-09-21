"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { PrivacyNotice } from "@/components/privacy-notice";
import { btnPrimary, inputClass } from "@/components/ui/primitives";
import {
  DISPLAY_NAME_RULE_TEXT,
  USERNAME_RULE_TEXT,
} from "@/lib/auth/username";

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== passwordConfirm) {
      setError("비밀번호가 서로 다릅니다.");
      return;
    }

    setPending(true);

    // 계정 생성은 반드시 서버에서 한다.
    // 초대 코드 검증을 브라우저에 맡기면 건너뛸 수 있기 때문.
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        displayName,
        password,
        inviteCode,
        agreed,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.message ?? "가입에 실패했습니다.");
      setPending(false);
      return;
    }

    // 가입에 성공했으면 바로 로그인시킨다.
    const loginResponse = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!loginResponse.ok) {
      setError(
        "가입은 됐지만 자동 로그인에 실패했습니다. 로그인 화면에서 다시 시도해 주세요.",
      );
      setPending(false);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <main className="flex flex-1 justify-center p-4 py-8 md:p-6">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold">가입하기</h1>
        <p className="mt-1 text-sm text-ink-500">
          초대 코드가 있어야 가입할 수 있습니다.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">아이디</span>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              required
              className={inputClass}
            />
            <span className="text-xs text-ink-500">{USERNAME_RULE_TEXT}</span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">표시 이름</span>
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              required
              className={inputClass}
            />
            <span className="text-xs text-ink-500">
              화면에 보이는 이름입니다. {DISPLAY_NAME_RULE_TEXT}
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">비밀번호</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              className={inputClass}
            />
            <span className="text-xs text-ink-500">8자 이상</span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">비밀번호 확인</span>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              autoComplete="new-password"
              required
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">초대 코드</span>
            <input
              type="text"
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
              autoCapitalize="characters"
              required
              className={inputClass + " uppercase"}
            />
            <span className="text-xs text-ink-500">
              대소문자는 구분하지 않습니다.
            </span>
          </label>

          <div className="mt-2 flex flex-col gap-2">
            <PrivacyNotice />
            <label className="flex items-start gap-2.5 rounded-lg border border-line bg-surface p-3">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
                required
                className="mt-0.5 size-5 shrink-0 accent-brand-600"
              />
              <span className="text-sm text-ink-700">
                위 내용을 읽었고, 이대로 저장·처리되는 데 동의합니다.
              </span>
            </label>
          </div>

          {error ? (
            <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-600">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending || !agreed}
            className={btnPrimary + " mt-2 w-full"}
          >
            {pending ? "가입 중..." : "가입하기"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-500">
          이미 계정이 있으신가요?{" "}
          <Link
            href="/login"
            className="font-medium text-brand-600 hover:underline"
          >
            로그인
          </Link>
        </p>
      </div>
    </main>
  );
}
