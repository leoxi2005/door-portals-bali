const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  ready: (info) => ipcRenderer.send('floor:ready', info),
  frame: (buf) => ipcRenderer.invoke('floor:frame', buf),
  done: () => ipcRenderer.invoke('floor:done'),
  fail: (msg) => ipcRenderer.send('floor:fail', msg),
  log: (msg) => ipcRenderer.send('floor:log', msg),
  onGo: (cb) => ipcRenderer.on('floor:go', () => cb()),
});
