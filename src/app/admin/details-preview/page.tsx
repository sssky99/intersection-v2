import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, isAdminSessionTokenValid } from "@/lib/adminAuth";
import { DetailsPreviewClient } from "./DetailsPreviewClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "상세페이지 미리보기 | 교집합",
  description: "교집합 운영자 전용 상세페이지 미리보기",
};

export default async function DetailsPreviewPage() {
  const cookieStore = await cookies();
  const authenticated = isAdminSessionTokenValid(
    cookieStore.get(ADMIN_SESSION_COOKIE)?.value,
  );

  if (!authenticated) {
    redirect("/admin");
  }

  return <DetailsPreviewClient />;
}
