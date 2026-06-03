const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("desktopApp", {
  isDesktop: true,
  version: "1.0.0",
});
