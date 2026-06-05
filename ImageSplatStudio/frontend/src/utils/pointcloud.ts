const POINTCLOUD_EXTENSIONS = new Set([
  ".ply",
  ".pcd",
  ".xyz",
  ".pts",
  ".las",
  ".laz",
  ".txt",
  ".obj",
  ".e57",
]);

export function isPointCloudFile(file: File): boolean {
  const ext = file.name.includes(".")
    ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
    : "";
  return POINTCLOUD_EXTENSIONS.has(ext);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getPointCloudExtension(name: string): string {
  if (!name.includes(".")) return "";
  return name.slice(name.lastIndexOf(".") + 1).toLowerCase();
}

export const SUPPORTED_POINTCLOUD_LABEL = ".ply, .txt, .xyz, .las, .laz, .pcd";
