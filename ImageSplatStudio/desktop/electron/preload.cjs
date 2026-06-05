const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("imageSplatDesktop", {
  isDesktop: true,
  version: "0.1.0",
});
