import { notFound } from "next/navigation";
import { MobileFrame } from "@/components/MobileFrame";
import { ProfileInfoPreview } from "@/features/app/ProfileInfoPreview";

export default function ProfileInfoPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <MobileFrame>
      <ProfileInfoPreview />
    </MobileFrame>
  );
}
