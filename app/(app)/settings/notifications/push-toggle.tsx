"use client";

import { useEffect, useState } from "react";
import { BellRing, Check, Smartphone } from "lucide-react";

import { saveSubscription } from "./actions";
import { btnPrimary } from "@/components/ui/primitives";

/* ============================================================
   알림 켜기는 단계가 많고, 어느 단계든 조용히 실패할 수 있다.
   그래서 단계마다 이름을 붙여 두고, 실패하면
   "몇 단계에서 / 왜 / 어떻게 하면 되는지" 를 화면에 그대로 보여 준다.
   ============================================================ */

const STEPS = [
  "브라우저 지원 확인",
  "서버 키 확인",
  "알림 권한 요청",
  "서비스 워커 등록",
  "서비스 워커 준비 대기",
  "구독 만들기",
  "서버에 저장",
] as const;

type Failure = {
  /** 1부터 센다. 0 이면 어느 단계인지 모른다는 뜻 */
  step: number;
  reason: string;
  hint?: string;
};

/** 단계에서 실패했음을 알리는 오류. 단계 번호를 함께 들고 다닌다. */
class StepError extends Error {
  step: number;
  hint?: string;

  constructor(step: number, reason: string, hint?: string) {
    super(reason);
    this.step = step;
    this.hint = hint;
  }
}

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

/** 두 바이트 묶음이 같은지 */
function sameBytes(a: ArrayBuffer | null, b: Uint8Array): boolean {
  if (!a) return false;
  const view = new Uint8Array(a);
  if (view.length !== b.length) return false;
  for (let i = 0; i < view.length; i += 1) {
    if (view[i] !== b[i]) return false;
  }
  return true;
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
  /** 여기까지는 통과했다 (1부터 센 단계 번호) */
  const [passed, setPassed] = useState(0);
  const [failure, setFailure] = useState<Failure | null>(null);

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
    setFailure(null);
    setPassed(0);
    setState("busy");

    try {
      // 1단계 — 브라우저 지원 확인
      if (!window.isSecureContext) {
        throw new StepError(
          1,
          "보안 연결(https)이 아닙니다.",
          "주소가 https:// 로 시작하는지 확인해 주세요.",
        );
      }
      if (!("serviceWorker" in navigator)) {
        throw new StepError(1, "이 브라우저에 서비스 워커가 없습니다.");
      }
      if (!("PushManager" in window)) {
        throw new StepError(
          1,
          "이 브라우저에 푸시 기능이 없습니다.",
          "아이폰이라면 홈 화면에 추가한 아이콘으로 열어야 합니다.",
        );
      }
      if (!("Notification" in window)) {
        throw new StepError(1, "이 브라우저에 알림 기능이 없습니다.");
      }
      setPassed(1);

      // 2단계 — 서버 키 확인
      if (!vapidPublicKey) {
        throw new StepError(
          2,
          "서버가 VAPID 공개 키를 주지 않았습니다.",
          "배포 서버의 VAPID_PUBLIC_KEY 환경변수를 확인해 주세요. /api/push/config 에서 들어왔는지 볼 수 있습니다.",
        );
      }

      let applicationServerKey: Uint8Array<ArrayBuffer>;
      try {
        applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
      } catch {
        throw new StepError(
          2,
          `서버가 준 키를 읽을 수 없습니다. (길이 ${vapidPublicKey.length}자)`,
          "환경변수에 넣을 때 값이 잘렸거나 따옴표가 섞였을 수 있습니다. 정상값은 87자입니다.",
        );
      }

      if (applicationServerKey.length !== 65) {
        throw new StepError(
          2,
          `서버가 준 키의 길이가 이상합니다. (${applicationServerKey.length}바이트, 정상 65바이트)`,
          "환경변수 값이 잘렸을 수 있습니다. .env.local 의 VAPID_PUBLIC_KEY 를 다시 복사해 넣어 주세요.",
        );
      }
      setPassed(2);

      // 3단계 — 알림 권한 요청
      let permission: NotificationPermission;
      try {
        permission = await Notification.requestPermission();
      } catch (error) {
        throw new StepError(
          3,
          `권한 요청이 실패했습니다. (${(error as Error)?.message ?? "이유 없음"})`,
        );
      }
      if (permission === "denied") {
        throw new StepError(
          3,
          "알림이 차단되어 있습니다.",
          "안드로이드 크롬: 주소창 왼쪽 자물쇠 → 권한 → 알림 → 허용. 폰 설정 → 앱 → Chrome → 알림도 켜져 있어야 합니다.",
        );
      }
      if (permission !== "granted") {
        throw new StepError(
          3,
          "권한 창에서 허용을 누르지 않았습니다.",
          "다시 눌러서 허용을 선택해 주세요.",
        );
      }
      setPassed(3);

      // 4단계 — 서비스 워커 등록
      let registration: ServiceWorkerRegistration;
      try {
        registration = await navigator.serviceWorker.register("/sw.js");
      } catch (error) {
        throw new StepError(
          4,
          `/sw.js 를 등록하지 못했습니다. (${(error as Error)?.message ?? "이유 없음"})`,
          "시크릿 모드이거나 브라우저가 사이트 데이터를 막고 있으면 실패합니다.",
        );
      }
      setPassed(4);

      // 5단계 — 서비스 워커 준비 대기 (여기서 멈추면 30초 뒤 알려 준다)
      const ready = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 30000)),
      ]);
      if (!ready) {
        throw new StepError(
          5,
          "서비스 워커가 30초 안에 준비되지 않았습니다.",
          "페이지를 새로고침한 뒤 다시 눌러 주세요.",
        );
      }
      setPassed(5);

      // 6단계 — 구독 만들기
      let subscription = await registration.pushManager.getSubscription();

      // 예전에 다른 키로 구독해 둔 것이 남아 있으면 그대로는 못 쓴다. 끊고 새로 만든다.
      if (
        subscription &&
        !sameBytes(subscription.options.applicationServerKey, applicationServerKey)
      ) {
        await subscription.unsubscribe();
        subscription = null;
      }

      if (!subscription) {
        try {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey,
          });
        } catch (error) {
          const e = error as Error;
          throw new StepError(
            6,
            `구독을 만들지 못했습니다. (${e?.name ?? "오류"}: ${e?.message ?? "이유 없음"})`,
            "구글 푸시 서버에 연결하지 못했을 때 자주 납니다. 와이파이·데이터를 바꿔서 다시 시도해 보세요.",
          );
        }
      }
      setPassed(6);

      // 7단계 — 서버에 저장
      const json = subscription.toJSON();
      let result: { ok: boolean; message: string };
      try {
        result = await saveSubscription(
          subscription.endpoint,
          {
            p256dh: json.keys?.p256dh ?? "",
            auth: json.keys?.auth ?? "",
          },
          deviceLabel(),
        );
      } catch (error) {
        throw new StepError(
          7,
          `서버에 보내지 못했습니다. (${(error as Error)?.message ?? "이유 없음"})`,
          "네트워크가 끊겼거나 로그인이 풀렸을 수 있습니다.",
        );
      }

      if (!result.ok) throw new StepError(7, result.message);
      setPassed(7);

      setState("done");
    } catch (error) {
      if (error instanceof StepError) {
        setFailure({ step: error.step, reason: error.message, hint: error.hint });
      } else {
        setFailure({
          step: 0,
          reason:
            error instanceof Error ? error.message : "알 수 없는 오류입니다.",
        });
      }
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

      {state === "busy" && passed > 0 ? (
        <p className="mt-2 text-sm text-ink-500">
          {passed}/{STEPS.length} · {STEPS[passed - 1]} 통과
        </p>
      ) : null}

      {failure ? (
        <div className="mt-2 rounded-lg bg-danger-50 px-3 py-2.5 text-sm text-danger-700">
          <p className="font-bold">
            {failure.step > 0
              ? `${failure.step}단계 「${STEPS[failure.step - 1]}」 에서 멈췄습니다`
              : "알 수 없는 곳에서 멈췄습니다"}
          </p>
          <p className="mt-1 break-words">{failure.reason}</p>
          {failure.hint ? (
            <p className="mt-1 break-words opacity-80">→ {failure.hint}</p>
          ) : null}

          {/* 어디까지 갔는지 눈으로 보이게 */}
          <ul className="mt-2 flex flex-col gap-0.5 border-t border-danger-100 pt-2 text-xs">
            {STEPS.map((label, index) => {
              const number = index + 1;
              const ok = number <= passed;
              const here = number === failure.step;
              return (
                <li
                  key={label}
                  className={
                    "flex items-center gap-1.5 " +
                    (here
                      ? "font-bold"
                      : ok
                        ? "text-success-700"
                        : "text-ink-400")
                  }
                >
                  {ok ? (
                    <Check className="size-3 shrink-0" aria-hidden />
                  ) : (
                    <span className="w-3 shrink-0 text-center">
                      {here ? "×" : "·"}
                    </span>
                  )}
                  {number}. {label}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
