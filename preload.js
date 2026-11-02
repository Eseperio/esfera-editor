const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("editor", {
  importStamp: () => ipcRenderer.invoke("import-stamp"),
  setLanguage: (language) => ipcRenderer.invoke("set-language", language),
  capabilities: () => ipcRenderer.invoke("capabilities"),
  selectSubject: (data) => ipcRenderer.invoke("select-subject", data),
  close: () => ipcRenderer.invoke("close-image"),
  open: (maxWidth) => ipcRenderer.invoke("open", maxWidth),
  apply: (document) => ipcRenderer.invoke("apply", document),
  export: (quality) => ipcRenderer.invoke("export", quality),
});
