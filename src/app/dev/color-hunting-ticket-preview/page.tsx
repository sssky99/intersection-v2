import { notFound } from "next/navigation";
import { ColorHuntingTicketPreview } from "@/features/color-hunting/ColorHuntingTicketPreview";
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ColorHuntingTicketPreview />;
}
