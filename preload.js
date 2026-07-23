const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (partial) => ipcRenderer.invoke('config:save', partial),

  ndi: {
    available: () => ipcRenderer.invoke('ndi:available'),
    start: (cfg) => ipcRenderer.invoke('ndi:start', cfg),
    stop: (name) => ipcRenderer.invoke('ndi:stop', name),
    status: () => ipcRenderer.invoke('ndi:status'),
    frame: (meta, data) => ipcRenderer.send('ndi:frame', meta, data)
  },

  onOsc: (cb) => {
    ipcRenderer.on('osc:message', (_e, msg) => cb(msg));
  }
});
