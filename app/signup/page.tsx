"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

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
      body: JSON.stringify({ username, displayName, password, inviteCode }),
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
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold">가입하기</h1>
        <p className="mt-1 text-sm text-gray-500">
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
              className="rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
            />
            <span className="text-xs text-gray-500">{USERNAME_RULE_TEXT}</span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">표시 이름</span>
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              required
              className="rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
            />
            <span className="text-xs text-gray-500">
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
              className="rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
            />
            <span className="text-xs text-gray-500">8자 이상</span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">비밀번호 확인</span>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              autoComplete="new-password"
              required
              className="rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
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
              className="rounded-md border border-gray-300 px-3 py-2 uppercase outline-none focus:border-blue-500"
            />
            <span className="text-xs text-gray-500">
              대소문자는 구분하지 않습니다.
            </span>
          </label>

          {error ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 rounded-md bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {pending ? "가입 중..." : "가입하기"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          이미 계정이 있으신가요?{" "}
          <Link
            href="/login"
            className="font-medium text-blue-600 hover:underline"
          >
            로그인
          </Link>
        </p>
      </div>
    </main>
  );
}
