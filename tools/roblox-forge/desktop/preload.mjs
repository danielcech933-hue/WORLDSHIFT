import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('forge', {
  status: () => ipcRenderer.invoke('process-status'),
  start: id => ipcRenderer.invoke('process-start', id),
  stop: id => ipcRenderer.invoke('process-stop', id),
  startStack: () => ipcRenderer.invoke('stack-start'),
  stopStack: () => ipcRenderer.invoke('stack-stop'),
  input: (id, value) => ipcRenderer.invoke('process-input', id, value),
  openFolder: () => ipcRenderer.invoke('open-folder'),
  onLog: callback => ipcRenderer.on('process-log', (_event, payload) => callback(payload)),
  onExit: callback => ipcRenderer.on('process-exit', (_event, payload) => callback(payload))
});
