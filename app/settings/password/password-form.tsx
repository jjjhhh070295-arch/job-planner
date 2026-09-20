"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { MIN_PASSWORD_LENGTH, PASSWORD_RULE_TEXT } from "@/lib/auth/password";

const inputClass =
  "rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500";

export function PasswordForm({ forced }: { forced: boolean }) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (newPassword !== confirm) {
      setError("새 비밀번호가 서로 다릅니다.");
      return;
    }

    setPending(true);
    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.message ?? "비밀번호를 바꾸지 못했습니다.");
      setPending(false);
      return;
    }

    setDone(true);
    setCurrentPassword("");
    setNewPassword("");
    setConfirm("");
    setPending(false);
    router.refresh();
  }

  if (done) {
    return (
      <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">
        비밀번호를 바꿨습니다.
        {forced ? " 이제 다른 화면을 이용할 수 있습니다." : null}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">기존 비밀번호</span>
        <input
          type="password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">새 비밀번호</span>
        <input
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
          className={inputClass}
        />
        <span className="text-xs text-gray-500">{PASSWORD_RULE_TEXT}</span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">새 비밀번호 확인</span>
        <input
          type="password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          autoComplete="new-password"
          required
          className={inputClass}
        />
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
        {pending ? "변경 중..." : "비밀번호 변경"}
      </button>
    </form>
  );
}
