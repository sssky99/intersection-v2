"use client";

import { LandingVariantBContent } from "@/features/landing/LandingVariantBPreview";

export function SpecialInvitationLanding({ preview = true }: { preview?: boolean }) {
  return <LandingVariantBContent preview={preview} specialInvitation />;
}
