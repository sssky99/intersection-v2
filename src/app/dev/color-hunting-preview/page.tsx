import { notFound } from "next/navigation";
import { ColorHuntingPreview } from "@/features/color-hunting/ColorHuntingPreview";
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ColorHuntingPreview startsAt="2026-08-15T19:00:00+09:00" />;
}
