const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('jarvisDesktop', {
  project: () => ipcRenderer.invoke('project-info'),
  chooseProject: () => ipcRenderer.invoke('choose-project'),
  runtime: () => ipcRenderer.invoke('runtime-status'),
  request: (path, body) => ipcRenderer.invoke('jarvis-request', { path, body }),
});
