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
const verificationRetryDelaysMs = [0, 120, 300, 600];

async function wait(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

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
  let storedFile:
    | { name: string; metadata?: Record<string, unknown> | null }
    | undefined;
  let lastListError: { message?: string } | null = null;

  for (const delayMs of verificationRetryDelaysMs) {
    await wait(delayMs);
    const { data: files, error: listError } = await admin.storage
      .from(bucket)
      .list(user.id, { limit: 10, search: filename });
    lastListError = listError;
    storedFile = files?.find((file) => file.name === filename);
    if (storedFile) break;
  }

  if (!storedFile) {
    console.error(
      "Uploaded profile photo verification failed:",
      lastListError?.message ?? "uploaded object was not visible after retries",
    );
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
