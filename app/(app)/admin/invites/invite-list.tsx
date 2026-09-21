"use client";

import { useState } from "react";
import { Ban, Check, Copy, RotateCw } from "lucide-react";

import { disableInviteCode, extendInviteCode } from "./actions";
import { Tag, btnIcon } from "@/components/ui/primitives";

export type InviteRow = {
  id: string;
  code: string;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  expiresText: string | null;
  expired: boolean;
  memo: string | null;
  users: string[];
};

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // 클립보드를 막아 둔 브라우저에서는 직접 긁어서 복사하면 된다.
        }
      }}
      aria-label={`${code} 복사`}
      className={btnIcon}
    >
      {copied ? (
        <Check className="size-4 text-success-700" aria-hidden />
      ) : (
        <Copy className="size-4" aria-hidden />
      )}
    </button>
  );
}

export function InviteList({ items }: { items: InviteRow[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-surface px-4 py-8 text-center text-sm text-ink-500">
        아직 만든 초대 코드가 없습니다.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => {
        const soldOut = item.usedCount >= item.maxUses;
        const usable = !item.expired && !soldOut;

        return (
          <li
            key={item.id}
            className="rounded-xl border border-line bg-surface p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <code className="font-mono text-lg font-bold tracking-wider">
                    {item.code}
                  </code>
                  <CopyButton code={item.code} />
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Tag tone={usable ? "brand" : "muted"}>
                    {item.usedCount}/{item.maxUses}회 사용
                  </Tag>
                  {item.expired ? (
                    <Tag tone="muted">기간 지남</Tag>
                  ) : soldOut ? (
                    <Tag tone="muted">모두 사용됨</Tag>
                  ) : (
                    <Tag tone="success">사용 가능</Tag>
                  )}
                </div>

                <p className="mt-1 text-xs text-ink-400">
                  {item.expiresText
                    ? `${item.expiresText} 까지`
                    : "기간 제한 없음"}
                  {item.memo ? ` · ${item.memo}` : ""}
                </p>

                {item.users.length > 0 ? (
                  <p className="mt-2 text-xs text-ink-500">
                    가입한 사람: {item.users.join(", ")}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 items-start">
                {item.expired ? (
                  <form action={extendInviteCode}>
                    <input type="hidden" name="id" value={item.id} />
                    <button
                      type="submit"
                      aria-label={`${item.code} 30일 연장`}
                      title="30일 연장"
                      className={btnIcon}
                    >
                      <RotateCw className="size-4" aria-hidden />
                    </button>
                  </form>
                ) : (
                  <form action={disableInviteCode}>
                    <input type="hidden" name="id" value={item.id} />
                    <button
                      type="submit"
                      aria-label={`${item.code} 사용 막기`}
                      title="지금부터 못 쓰게 막기"
                      className={btnIcon + " hover:bg-danger-50 hover:text-danger-600"}
                    >
                      <Ban className="size-4" aria-hidden />
                    </button>
                  </form>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
