import type { Metadata } from "next";
import { LandingVariantB } from "@/features/landing/LandingVariantBPreview";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "교집합 | 나와 잘 맞는 사람들과의 만남",
  description: "나와 잘 맞는 사람들을 찾아주는 교집합. 취미와 관심사, 대화 성향을 바탕으로 함께할 사람들과 새로운 경험을 만나보세요.",
  alternates: { canonical: "https://interv2.netlify.app/" },
  robots: { index: true, follow: true },
  verification: { google: "FqX5zcLf_XdlZKJbAfhW9H9GHI2yerFYV9rlUFF0pOw" },
};

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "WebSite", name: "교집합", url: "https://interv2.netlify.app/",
      }) }} />
      <LandingVariantB />
      <noscript><section><h1>교집합</h1><p>나와 잘 맞는 사람들을 찾아주는 교집합. 취미와 관심사, 대화 성향을 바탕으로 함께할 사람들과 새로운 경험을 만나보세요.</p><p>질문 답변과 회원가입을 진행하려면 브라우저에서 JavaScript를 켜주세요.</p></section></noscript>
    </>
  );
}
