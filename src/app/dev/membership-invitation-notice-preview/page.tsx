import { notFound } from "next/navigation";
import { MobileFrame } from "@/components/MobileFrame";
import { NoticePreview } from "./NoticePreview";

export default function MembershipInvitationNoticePreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <MobileFrame><NoticePreview /></MobileFrame>;
}
