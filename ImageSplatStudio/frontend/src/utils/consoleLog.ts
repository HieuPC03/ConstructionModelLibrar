export type ConsoleLevel = "info" | "warn" | "success" | "error";

export interface ConsoleEntry {
  id: string;
  time: string;
  level: ConsoleLevel;
  message: string;
}

let counter = 0;
const listeners = new Set<(entries: ConsoleEntry[]) => void>();
let entries: ConsoleEntry[] = [];

function emit() {
  listeners.forEach((fn) => fn(entries));
}

export function subscribeConsole(fn: (entries: ConsoleEntry[]) => void): () => void {
  listeners.add(fn);
  fn(entries);
  return () => listeners.delete(fn);
}

export function logConsole(message: string, level: ConsoleLevel = "info"): void {
  const entry: ConsoleEntry = {
    id: `${Date.now()}-${counter++}`,
    time: new Date().toLocaleTimeString(),
    level,
    message,
  };
  entries = [...entries.slice(-199), entry];
  emit();
}

export function clearConsole(): void {
  entries = [];
  emit();
}
