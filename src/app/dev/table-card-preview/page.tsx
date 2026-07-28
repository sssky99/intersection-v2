import { notFound } from "next/navigation";
import { MobileFrame } from "@/components/MobileFrame";
import { TableCardSurveyPreview } from "@/features/onboarding/TableCardSurveyPreview";

export default function TableCardPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <MobileFrame>
      <TableCardSurveyPreview />
    </MobileFrame>
  );
}
