import type { LangCode } from "../types";

export function langBadge(code: LangCode | string | undefined): string {
  if (!code || code === "auto") return "";
  if (code === "vi") return "VI";
  if (code === "ja") return "JA";
  if (code === "en") return "EN";
  return code.toUpperCase();
}
