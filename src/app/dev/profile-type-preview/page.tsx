import { notFound } from "next/navigation";
import { MobileFrame } from "@/components/MobileFrame";
import {
  profileArchetypeIds,
  type ProfileArchetypeId,
} from "@/data/profileArchetypes";
import { ProfileTypeInvitationPreview } from "./ProfileTypeInvitationPreview";

export default async function ProfileTypePreviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ type?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const requestedType = (await searchParams)?.type;
  const archetypeId = profileArchetypeIds.includes(
    requestedType as ProfileArchetypeId,
  )
    ? (requestedType as ProfileArchetypeId)
    : "romantic";

  return (
    <MobileFrame>
      <ProfileTypeInvitationPreview archetypeId={archetypeId} />
    </MobileFrame>
  );
}
