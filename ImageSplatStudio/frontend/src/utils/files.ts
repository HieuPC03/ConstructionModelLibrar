/** Extensions accepted by backend — keep in sync with backend/app/config.py */
export const SUPPORTED_IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".tif",
  ".tiff",
  ".gif",
  ".bmp",
]);

const UNSUPPORTED_HINT = new Set([".heic", ".heif"]);

export function getFileExtension(name: string): string {
  if (!name.includes(".")) return "";
  return name.slice(name.lastIndexOf(".")).toLowerCase();
}

export function isSupportedImageFile(file: File): boolean {
  const ext = getFileExtension(file.name);
  if (SUPPORTED_IMAGE_EXTENSIONS.has(ext)) return true;
  if (UNSUPPORTED_HINT.has(ext)) return false;
  const mime = file.type.toLowerCase();
  return (
    mime === "image/jpeg" ||
    mime === "image/png" ||
    mime === "image/webp" ||
    mime === "image/tiff" ||
    mime === "image/gif" ||
    mime === "image/bmp"
  );
}

export function isHeicFile(file: File): boolean {
  const ext = getFileExtension(file.name);
  return UNSUPPORTED_HINT.has(ext) || file.type.includes("heic") || file.type.includes("heif");
}

export function fileKey(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

/** @deprecated use isSupportedImageFile */
export function isImageFile(file: File): boolean {
  return isSupportedImageFile(file);
}
