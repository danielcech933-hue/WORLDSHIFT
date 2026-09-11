import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('forge', {
  status: () => ipcRenderer.invoke('process-status'),
  project: () => ipcRenderer.invoke('project-get'),
  chooseProject: () => ipcRenderer.invoke('project-choose'),
  start: id => ipcRenderer.invoke('process-start', id),
  stop: id => ipcRenderer.invoke('process-stop', id),
  startStack: () => ipcRenderer.invoke('stack-start'),
  stopStack: () => ipcRenderer.invoke('stack-stop'),
  input: (id, value) => ipcRenderer.invoke('process-input', id, value),
  onLog: callback => ipcRenderer.on('process-log', (_event, payload) => callback(payload)),
  onExit: callback => ipcRenderer.on('process-exit', (_event, payload) => callback(payload))
});
