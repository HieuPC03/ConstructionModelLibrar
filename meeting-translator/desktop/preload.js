const { contextBridge, ipcRenderer } = require("electron");

const BACKEND_PORT = 17888;
const BACKEND_ORIGIN = `http://127.0.0.1:${BACKEND_PORT}`;

contextBridge.exposeInMainWorld("desktopApp", {
  isDesktop: true,
  version: "1.7.1",
  backendPort: BACKEND_PORT,
  backendOrigin: BACKEND_ORIGIN,
  openConfigFolder: () => ipcRenderer.invoke("open-config-folder"),
  pickFolder: () => ipcRenderer.invoke("pick-folder"),
});
