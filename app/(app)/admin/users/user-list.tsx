"use client";

import { useState } from "react";

type UserRow = {
  username: string;
  displayName: string;
  mustChangePassword: boolean;
};

type Issued = {
  username: string;
  displayName: string;
  tempPassword: string;
};

export function UserList({ users }: { users: UserRow[] }) {
  const [issued, setIssued] = useState<Issued | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingFor, setPendingFor] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function issueTempPassword(username: string, displayName: string) {
    const confirmed = window.confirm(
      `${displayName}(@${username}) 의 비밀번호를 임시 비밀번호로 덮어씁니다.\n` +
        "기존 비밀번호는 즉시 쓸 수 없게 됩니다. 계속할까요?",
    );
    if (!confirmed) return;

    setError(null);
    setIssued(null);
    setCopied(false);
    setPendingFor(username);

    const response = await fetch("/api/admin/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });

    const data = await response.json().catch(() => null);
    setPendingFor(null);

    if (!response.ok) {
      setError(data?.message ?? "임시 비밀번호를 발급하지 못했습니다.");
      return;
    }

    setIssued({
      username: data.username,
      displayName: data.displayName,
      tempPassword: data.tempPassword,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {issued ? (
        <div className="rounded-md border border-line bg-muted-100 p-4">
          <p className="text-sm font-medium text-muted-600">
            {issued.displayName}(@{issued.username}) 의 임시 비밀번호
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 rounded border border-line bg-white px-3 py-2 font-mono text-lg tracking-wider">
              {issued.tempPassword}
            </code>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(issued.tempPassword);
                setCopied(true);
              }}
              className="rounded-md border border-line px-3 py-2 text-sm font-medium text-muted-600 hover:bg-muted-100"
            >
              {copied ? "복사됨" : "복사"}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-600">
            이 값은 지금 이 화면에서만 볼 수 있습니다. 어디에도 저장되지 않으니
            본인에게 전달한 뒤 이 화면을 닫으세요. 본인은 로그인 후 곧바로
            비밀번호를 바꿔야 합니다.
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-600">
          {error}
        </p>
      ) : null}

      <ul className="divide-y divide-line rounded-md border border-line">
        {users.map((user) => (
          <li
            key={user.username}
            className="flex items-center justify-between gap-4 p-4"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{user.displayName}</p>
              <p className="truncate text-sm text-ink-500">@{user.username}</p>
              {user.mustChangePassword ? (
                <p className="mt-1 text-xs text-muted-600">
                  임시 비밀번호 상태 (본인이 아직 안 바꿈)
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => issueTempPassword(user.username, user.displayName)}
              disabled={pendingFor === user.username}
              className="shrink-0 rounded-md border border-line px-3 py-1.5 text-sm font-medium hover:bg-muted-100 disabled:opacity-50"
            >
              {pendingFor === user.username ? "발급 중..." : "임시 비밀번호"}
            </button>
          </li>
        ))}
      </ul>

      {users.length === 0 ? (
        <p className="text-sm text-ink-500">가입한 사용자가 없습니다.</p>
      ) : null}
    </div>
  );
}
