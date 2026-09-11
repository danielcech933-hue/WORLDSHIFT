import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('forge', {
  info: () => ipcRenderer.invoke('app-info'),
  status: () => ipcRenderer.invoke('process-status'),
  project: () => ipcRenderer.invoke('project-get'),
  chooseProject: () => ipcRenderer.invoke('project-choose'),
  resetProject: () => ipcRenderer.invoke('project-reset'),
  start: id => ipcRenderer.invoke('process-start', id),
  stop: id => ipcRenderer.invoke('process-stop', id),
  startStack: () => ipcRenderer.invoke('stack-start'),
  stopStack: () => ipcRenderer.invoke('stack-stop'),
  input: (id, value) => ipcRenderer.invoke('process-input', id, value),
  openFolder: () => ipcRenderer.invoke('open-folder'),
  onLog: callback => ipcRenderer.on('process-log', (_event, payload) => callback(payload)),
  onExit: callback => ipcRenderer.on('process-exit', (_event, payload) => callback(payload)),
  onError: callback => ipcRenderer.on('app-error', (_event, payload) => callback(payload)),
});
