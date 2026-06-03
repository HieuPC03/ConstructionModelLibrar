export async function copyText(text: string): Promise<void> {
  if (!text.trim()) return;
  await navigator.clipboard.writeText(text);
}
