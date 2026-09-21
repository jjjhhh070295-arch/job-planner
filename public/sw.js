// 아주 작은 서비스 워커.
// 크롬이 "홈 화면에 추가" 를 제안하려면 fetch 를 듣는 서비스 워커가 있어야 한다.
// 일부러 아무것도 캐시하지 않는다. 캐시를 잘못 잡으면 바뀐 화면이 안 나와서
// 원인을 찾기가 아주 어려워진다.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // 그대로 통과시킨다.
});
