import type { MetadataRoute } from "next";

/**
 * 홈 화면에 추가할 수 있게 해 주는 설정.
 * 아이콘은 public/ 에 직접 만들어 둔 PNG 를 쓴다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "취업 플래너",
    short_name: "취업 플래너",
    description: "지원 현황, 자소서, 면접 복기, 공부 기록을 한곳에서 관리합니다.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f2f5f9",
    theme_color: "#2563eb",
    lang: "ko",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
