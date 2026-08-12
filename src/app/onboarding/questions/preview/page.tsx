import { notFound } from "next/navigation";
import { MobileFrame } from "@/components/MobileFrame";
import { PreferenceQuestionFlow } from "@/features/onboarding/TableCardSurveyPreview";

export default function QuestionPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <MobileFrame>
      <PreferenceQuestionFlow mode="preview" />
    </MobileFrame>
  );
}
