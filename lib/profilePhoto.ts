import { createClient } from "@/lib/supabase/client";

function sanitizeStorageFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function uploadProfilePhoto(userId: string, file: File) {
  const supabase = createClient();
  const storagePath = `${userId}/${Date.now()}-${sanitizeStorageFileName(
    file.name,
  )}`;
  const { error } = await supabase.storage
    .from("profile-photos")
    .upload(storagePath, file, {
      cacheControl: "3600",
      contentType: file.type || undefined,
      upsert: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  return supabase.storage.from("profile-photos").getPublicUrl(storagePath).data
    .publicUrl;
}
