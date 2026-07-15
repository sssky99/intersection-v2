import { notFound } from "next/navigation";
import { MobileFrame } from "@/components/MobileFrame";
import { QuestionFlow } from "@/features/onboarding/QuestionFlow";

export default function QuestionPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <MobileFrame>
      <QuestionFlow initialRows={[]} mode="preview" />
    </MobileFrame>
  );
}
