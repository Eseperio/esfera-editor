const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("editor", {
  modelStatus: () => ipcRenderer.invoke("model-status"),
  installModel: () => ipcRenderer.invoke("install-model"),
  cancelModelInstall: () => ipcRenderer.invoke("cancel-model-install"),
  onModelProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on("model-progress", listener);
    return () => ipcRenderer.removeListener("model-progress", listener);
  },
  importStamp: () => ipcRenderer.invoke("import-stamp"),
  setLanguage: (language) => ipcRenderer.invoke("set-language", language),
  capabilities: () => ipcRenderer.invoke("capabilities"),
  selectSubject: (data) => ipcRenderer.invoke("select-subject", data),
  confirmDiscard: () => ipcRenderer.invoke("confirm-discard"),
  close: () => ipcRenderer.invoke("close-image"),
  open: (maxWidth) => ipcRenderer.invoke("open", maxWidth),
  apply: (document) => ipcRenderer.invoke("apply", document),
  export: (quality) => ipcRenderer.invoke("export", quality),
});
