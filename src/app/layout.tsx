import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { GA_MEASUREMENT_ID } from "@/lib/analytics";
import { ClarityScript } from "./ClarityScript";
import "./globals.css";

export const metadata: Metadata = {
  title: "교집합",
  description: "교집합 서비스의 모바일 퍼스트 프론트엔드 목업",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        {children}
        {GA_MEASUREMENT_ID && (
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            strategy="afterInteractive"
          />
        )}
        <ClarityScript />
        {GA_MEASUREMENT_ID && (
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){window.dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_MEASUREMENT_ID}');
            `}
          </Script>
        )}
      </body>
    </html>
  );
}
