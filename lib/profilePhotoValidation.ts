const maxSourceBytes = 30 * 1024 * 1024;
const supportedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export function validateProfilePhoto(file: { size: number; type: string }) {
  if (!supportedImageTypes.has(file.type.toLowerCase())) {
    return "JPG, PNG, WebP 또는 HEIC 사진을 선택해주세요.";
  }
  if (file.size > maxSourceBytes) {
    return "사진 용량은 30MB 이하여야 해요.";
  }
  return null;
}
