import {
  CalendarDays,
  Home,
  Layers,
  Library,
  User,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** CLAUDE.md 4장의 화면 5개. 데스크톱 사이드바와 모바일 하단 탭이 같은 목록을 쓴다. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "홈", icon: Home },
  { href: "/calendar", label: "캘린더", icon: CalendarDays },
  { href: "/applications", label: "지원 현황", icon: Layers },
  { href: "/library", label: "라이브러리", icon: Library },
  { href: "/profile", label: "프로필", icon: User },
];

/** 현재 경로가 그 메뉴에 속하는지. 홈만 정확히 일치를 본다. */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
