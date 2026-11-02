const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('editor',{close:()=>ipcRenderer.invoke('close-image'),open:()=>ipcRenderer.invoke('open'),apply:(mask,options)=>ipcRenderer.invoke('apply',mask,options),export:quality=>ipcRenderer.invoke('export',quality)});
