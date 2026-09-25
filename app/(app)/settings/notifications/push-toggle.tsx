"use client";

import { useEffect, useState } from "react";
import { BellRing, Smartphone } from "lucide-react";

import { saveSubscription } from "./actions";
import { btnPrimary } from "@/components/ui/primitives";

/** base64url VAPID 공개 키를 브라우저가 요구하는 바이트 배열로 바꾼다. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  // 버퍼를 먼저 만들어 둔다. 브라우저 타입이 ArrayBuffer 를 요구한다.
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

/** 어느 기기인지 나중에 알아볼 수 있게 짧은 이름을 만든다. */
function deviceLabel(): string {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad/.test(ua)
    ? "아이폰"
    : /Android/.test(ua)
      ? "안드로이드"
      : /Mac/.test(ua)
        ? "맥"
        : /Windows/.test(ua)
          ? "윈도우"
          : "기기";
  const browser = /CriOS|Chrome/.test(ua)
    ? "크롬"
    : /Edg/.test(ua)
      ? "엣지"
      : /Safari/.test(ua)
        ? "사파리"
        : "브라우저";
  return `${os} ${browser}`;
}

export function PushToggle({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const [state, setState] = useState<
    "checking" | "unsupported" | "needs-install" | "ready" | "busy" | "done"
  >("checking");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      // 아이폰 사파리는 홈 화면에 추가해야 PushManager 가 생긴다.
      const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent);
      setState(isIos ? "needs-install" : "unsupported");
      return;
    }
    setState("ready");
  }, []);

  async function enable() {
    setError(null);

    if (!vapidPublicKey) {
      setError("서버에 VAPID 공개 키가 없습니다. 운영자에게 알려 주세요.");
      return;
    }

    setState("busy");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError(
          "알림이 차단되어 있습니다. 브라우저 주소창 옆 자물쇠에서 알림을 허용해 주세요.",
        );
        setState("ready");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        }));

      const json = subscription.toJSON();
      const result = await saveSubscription(
        subscription.endpoint,
        {
          p256dh: json.keys?.p256dh ?? "",
          auth: json.keys?.auth ?? "",
        },
        deviceLabel(),
      );

      if (!result.ok) {
        setError(result.message);
        setState("ready");
        return;
      }

      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "알림을 켜지 못했습니다.");
      setState("ready");
    }
  }

  if (state === "checking") {
    return <p className="text-sm text-ink-400">확인 중...</p>;
  }

  if (state === "needs-install") {
    return (
      <div className="flex gap-2 rounded-lg bg-brand-50 px-3 py-2.5 text-sm text-brand-700">
        <Smartphone className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          <strong>아이폰은 홈 화면에 추가해야 알림을 받을 수 있습니다.</strong>
          <br />
          사파리 아래쪽 공유 버튼 → <strong>홈 화면에 추가</strong> → 홈 화면의
          아이콘으로 다시 연 뒤 이 화면에서 알림을 켜 주세요. 사파리 탭에서는
          아이폰이 알림을 막습니다.
        </span>
      </div>
    );
  }

  if (state === "unsupported") {
    return (
      <p className="rounded-lg bg-muted-100 px-3 py-2.5 text-sm text-muted-600">
        이 브라우저는 웹 알림을 지원하지 않습니다. 크롬이나 엣지에서 열어
        보세요.
      </p>
    );
  }

  if (state === "done") {
    return (
      <p className="rounded-lg bg-success-50 px-3 py-2.5 text-sm text-success-700">
        이 기기에서 알림을 받습니다. 아래에서 <strong>테스트 알림 보내기</strong>{" "}
        를 눌러 확인해 보세요.
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={enable}
        disabled={state === "busy"}
        className={btnPrimary}
      >
        <BellRing className="size-4" aria-hidden />
        {state === "busy" ? "켜는 중..." : "이 기기에서 알림 켜기"}
      </button>

      {error ? (
        <p className="mt-2 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
