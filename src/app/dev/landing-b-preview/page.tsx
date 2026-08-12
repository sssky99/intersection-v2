import { notFound } from "next/navigation";
import { LandingVariantBPreview } from "@/features/landing/LandingVariantBPreview";

export default function LandingVariantBPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return <LandingVariantBPreview />;
}
