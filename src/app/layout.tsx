import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { GA_MEASUREMENT_ID } from "@/lib/analytics";
import { ClarityScript } from "./ClarityScript";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://interv2.netlify.app"),
  title: "교집합",
  description: "나와 잘 맞는 사람들을 찾아주는 교집합",
  openGraph: {
    type: "website",
    url: "/",
    siteName: "교집합",
    title: "교집합",
    description: "나와 잘 맞는 사람들을 찾아주는 교집합",
    images: [
      {
        url: "/images/channel-logo.jpg",
        width: 1024,
        height: 1024,
        alt: "교집합",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "교집합",
    description: "나와 잘 맞는 사람들을 찾아주는 교집합",
    images: ["/images/channel-logo.jpg"],
  },
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
