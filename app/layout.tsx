import type { Metadata, Viewport } from "next";
import { ServiceWorker } from "@/components/service-worker";
import "./globals.css";

// 본문 글꼴은 Pretendard 다. globals.css 에서 받아 온다.
// next/font 는 구글 폰트만 다루는데 Pretendard 는 거기에 없다.

export const metadata: Metadata = {
  title: "취업 플래너",
  description: "취업 준비 일정과 로드맵을 한곳에서 관리합니다.",
  applicationName: "취업 플래너",
  // 아이폰에서 홈 화면에 추가했을 때 주소창 없이 앱처럼 뜨게 한다.
  appleWebApp: {
    capable: true,
    title: "취업플래너",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 아이폰 홈바 영역까지 화면을 쓰되, safe-area-inset 으로 여백을 준다.
  viewportFit: "cover",
  themeColor: "#2563eb",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
