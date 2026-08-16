import { notFound } from "next/navigation";
import { MobileFrame } from "@/components/MobileFrame";
import { PaymentSheetPreview } from "./PaymentSheetPreview";

export default function PaymentSheetPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <MobileFrame>
      <PaymentSheetPreview />
    </MobileFrame>
  );
}
