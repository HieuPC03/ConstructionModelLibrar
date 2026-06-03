/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface DesktopAppBridge {
  isDesktop: boolean;
  version: string;
  openConfigFolder?: () => Promise<string>;
  pickFolder?: () => Promise<string | null>;
}

interface Window {
  desktopApp?: DesktopAppBridge;
}
