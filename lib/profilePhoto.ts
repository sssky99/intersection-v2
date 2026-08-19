import { createClient } from "@/lib/supabase/client";
import { validateProfilePhoto } from "./profilePhotoValidation";

function sanitizeStorageFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

const reliableStandardUploadBytes = 6 * 1024 * 1024;
const maxImageDimension = 1600;

async function loadImage(file: File) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = objectUrl;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function compressProfilePhoto(file: File) {
  try {
    const image = await loadImage(file);
    const scale = Math.min(
      1,
      maxImageDimension / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.84);
    });
    if (!blob) throw new Error("Image conversion failed.");
    const stem = file.name.replace(/\.[^.]+$/, "") || "profile-photo";
    return new File([blob], `${stem}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    if (file.size <= reliableStandardUploadBytes) return file;
    throw new Error("사진을 줄이지 못했어요. 다른 사진으로 다시 시도해주세요.");
  }
}

async function finalizeProfilePhoto(storagePath: string) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await fetch("/api/profile/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath }),
      });
    } catch (error) {
      if (attempt === 1) throw error;
    }
  }
  throw new Error("Profile photo finalization failed.");
}

export async function uploadProfilePhoto(userId: string, file: File) {
  const validationError = validateProfilePhoto(file);
  if (validationError) throw new Error(validationError);

  const preparedFile = await compressProfilePhoto(file);
  if (preparedFile.size > reliableStandardUploadBytes) {
    throw new Error("사진 용량이 너무 커요. 다른 사진으로 다시 시도해주세요.");
  }

  const supabase = createClient();
  const storagePath = `${userId}/${Date.now()}-${sanitizeStorageFileName(
    preparedFile.name,
  )}`;
  const { error } = await supabase.storage
    .from("profile-photos")
    .upload(storagePath, preparedFile, {
      cacheControl: "3600",
      contentType: preparedFile.type,
      upsert: false,
    });

  if (error) {
    throw new Error("사진 업로드에 실패했어요. 다시 시도해주세요.");
  }

  const response = await finalizeProfilePhoto(storagePath).catch(() => null);
  if (!response) {
    throw new Error("사진 저장 중 연결이 끊겼어요. 다시 시도해주세요.");
  }
  const result = (await response.json().catch(() => null)) as
    | { photoUrl?: string; error?: string }
    | null;
  if (!response.ok || !result?.photoUrl) {
    throw new Error("사진 정보를 저장하지 못했어요. 다시 시도해주세요.");
  }

  return result.photoUrl;
}
