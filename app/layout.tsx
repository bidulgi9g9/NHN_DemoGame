import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Glow Grid — 빛을 연결하세요",
  description: "작은 움직임으로 큰 빛을 만드는 데일리 퍼즐게임.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
