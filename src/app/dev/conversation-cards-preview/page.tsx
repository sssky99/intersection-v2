import { notFound } from "next/navigation";
import { MobileFrame } from "@/components/MobileFrame";
import { ConversationCards } from "@/features/meetings/ConversationCards";

export default function ConversationCardsPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <MobileFrame>
      <main className="min-h-dvh bg-[#f7f4ed] px-5 pb-12 pt-7 text-black">
        <ConversationCards />
      </main>
    </MobileFrame>
  );
}
