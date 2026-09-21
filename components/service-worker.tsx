"use client";

import { useEffect } from "react";

/** 서비스 워커를 등록한다. 실패해도 앱은 그대로 동작한다. */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // 등록에 실패하면 홈 화면 추가 제안만 안 뜰 뿐이다.
    });
  }, []);

  return null;
}
