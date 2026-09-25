// 서비스 워커.
//  - 크롬이 "홈 화면에 추가" 를 제안하려면 fetch 를 듣는 서비스 워커가 있어야 한다
//  - 웹 푸시 알림도 서비스 워커가 받는다
//
// 일부러 아무것도 캐시하지 않는다. 캐시를 잘못 잡으면 바뀐 화면이 안 나와서
// 원인을 찾기가 아주 어려워진다.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", () => {
  // 그대로 통과시킨다.
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || "취업 플래너";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    // 같은 tag 의 알림은 덮어쓴다. 알림이 쌓여 쓰레기가 되는 것을 막는다.
    tag: data.url || "job-planner",
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // 이미 열린 탭이 있으면 그 탭을 쓴다. 탭이 계속 늘어나지 않게.
      for (const client of windows) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(target);
          return;
        }
      }

      if (self.clients.openWindow) await self.clients.openWindow(target);
    })(),
  );
});
