"use client";

import { useActionState, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";

import { deleteAccount, sendFeedback, updateDisplayName } from "./actions";
import {
  btnGhost,
  btnPrimary,
  inputClass,
} from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/client";

export function DisplayNameForm({ current }: { current: string }) {
  const [state, action, pending] = useActionState(updateDisplayName, null);

  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink-700">표시 이름</span>
        <input
          name="display_name"
          defaultValue={current}
          maxLength={20}
          required
          className={inputClass + " h-11"}
        />
        <span className="text-xs text-ink-400">
          화면에 보이는 이름입니다. 1~20자, 한글도 됩니다. 로그인 아이디는 바꿀
          수 없습니다.
        </span>
      </label>

      {state ? (
        <p
          className={
            "rounded-lg px-3 py-2 text-sm " +
            (state.ok
              ? "bg-success-50 text-success-700"
              : "bg-danger-50 text-danger-700")
          }
        >
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className={btnPrimary + " self-start"}
      >
        {pending ? "저장 중..." : "저장"}
      </button>
    </form>
  );
}

export function FeedbackForm() {
  const pathname = usePathname();
  const [state, action, pending] = useActionState(sendFeedback, null);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="page_path" value={pathname} />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink-700">
          불편한 점이나 바라는 점
        </span>
        <textarea
          name="message"
          rows={4}
          required
          minLength={5}
          maxLength={2000}
          placeholder="어디가 불편했는지, 무엇이 있으면 좋겠는지 적어 주세요."
          className={inputClass}
        />
      </label>

      {state ? (
        <p
          className={
            "rounded-lg px-3 py-2 text-sm " +
            (state.ok
              ? "bg-success-50 text-success-700"
              : "bg-danger-50 text-danger-700")
          }
        >
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className={btnPrimary + " self-start"}
      >
        {pending ? "보내는 중..." : "보내기"}
      </button>
    </form>
  );
}

export function DeleteAccountForm({ username }: { username: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(deleteAccount, null);

  // 탈퇴가 끝나면 남아 있는 세션 쿠키를 지우고 로그인 화면으로 보낸다.
  useEffect(() => {
    if (!state?.ok) return;
    (async () => {
      try {
        await createClient().auth.signOut();
      } catch {
        // 계정이 이미 사라져 실패해도 아래 이동은 해야 한다.
      }
      router.replace("/login");
      router.refresh();
    })();
  }, [state, router]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={btnGhost + " border-danger-100 text-danger-700"}
      >
        회원 탈퇴
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex gap-2 rounded-lg bg-danger-50 px-3 py-2.5 text-sm text-danger-700">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          탈퇴하면 프로필, 지원 현황, 자소서, 목표와 할 일, 일정이{" "}
          <strong>모두 즉시 삭제</strong>됩니다. 되돌릴 수 없습니다.
        </span>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink-700">
          확인을 위해 아이디 <code className="font-mono">{username}</code> 를
          입력하세요
        </span>
        <input
          name="confirm_username"
          autoComplete="off"
          autoCapitalize="none"
          required
          className={inputClass + " h-11"}
        />
      </label>

      {state && !state.ok ? (
        <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
          {state.message}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="tap inline-flex items-center justify-center rounded-lg bg-danger-600 px-4 text-sm font-medium text-white hover:bg-danger-700 disabled:opacity-50"
        >
          {pending ? "삭제 중..." : "영구 삭제"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={btnGhost}
        >
          취소
        </button>
      </div>
    </form>
  );
}
