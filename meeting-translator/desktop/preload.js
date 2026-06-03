const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopApp", {
  isDesktop: true,
  version: "1.5.4",
  openConfigFolder: () => ipcRenderer.invoke("open-config-folder"),
  pickFolder: () => ipcRenderer.invoke("pick-folder"),
});
