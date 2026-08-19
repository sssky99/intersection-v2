import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const bucket = "profile-photos";
const maxStoredPhotoBytes = 6 * 1024 * 1024;
const allowedStoredPhotoTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function ownedPhotoPath(userId: string, value: unknown) {
  if (typeof value !== "string" || value.length > 500) return null;
  const prefix = `${userId}/`;
  if (!value.startsWith(prefix) || value.includes("..")) return null;
  const filename = value.slice(prefix.length);
  if (!filename || filename.includes("/")) return null;
  return value;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { storagePath?: unknown }
    | null;
  const storagePath = ownedPhotoPath(user.id, body?.storagePath);
  if (!storagePath) {
    return NextResponse.json({ error: "Invalid photo path." }, { status: 400 });
  }

  const admin = createAdminClient();
  const filename = storagePath.slice(user.id.length + 1);
  const { data: files, error: listError } = await admin.storage
    .from(bucket)
    .list(user.id, { limit: 10, search: filename });

  const storedFile = files?.find((file) => file.name === filename);
  if (listError || !storedFile) {
    console.error("Uploaded profile photo verification failed:", listError?.message);
    return NextResponse.json({ error: "Uploaded photo was not found." }, { status: 409 });
  }

  const storedType = String(storedFile.metadata?.mimetype ?? "").toLowerCase();
  const storedSize = Number(storedFile.metadata?.size ?? 0);
  if (
    !allowedStoredPhotoTypes.has(storedType) ||
    !Number.isFinite(storedSize) ||
    storedSize <= 0 ||
    storedSize > maxStoredPhotoBytes
  ) {
    await admin.storage.from(bucket).remove([storagePath]);
    return NextResponse.json({ error: "Invalid photo file." }, { status: 400 });
  }

  const photoUrl = admin.storage.from(bucket).getPublicUrl(storagePath).data
    .publicUrl;
  const { data: updatedProfile, error: updateError } = await admin
    .from("profiles")
    .update({ photo_url: photoUrl })
    .eq("user_id", user.id)
    .select("photo_url")
    .maybeSingle<{ photo_url: string | null }>();

  if (updateError || updatedProfile?.photo_url !== photoUrl) {
    console.error("Profile photo URL save failed:", updateError?.message);
    const { error: cleanupError } = await admin.storage
      .from(bucket)
      .remove([storagePath]);
    if (cleanupError) {
      console.error("Unlinked profile photo cleanup failed:", cleanupError.message);
    }
    return NextResponse.json(
      { error: "Profile photo could not be saved." },
      { status: 500 },
    );
  }

  return NextResponse.json({ photoUrl });
}
