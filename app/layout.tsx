import type { Metadata } from "next";
import { Geist, Nanum_Myeongjo } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import "./flows.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const nanumMyeongjo = Nanum_Myeongjo({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "700", "800"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "마음, 한 잔 — 솔로파티 최종 선택";
  const description = "세 번의 선택으로 마음을 전하고, 나에게 도착한 마음을 단계별로 확인해요.";
  return {
    title,
    description,
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: { title, description, images: [{ url: `${origin}/og.jpg`, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [`${origin}/og.jpg`] },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${nanumMyeongjo.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
