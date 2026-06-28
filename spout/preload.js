const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vjBridge', {
  send: (channel, data) => ipcRenderer.send(channel, data),
  on: (channel, cb) => ipcRenderer.on(channel, (event, data) => cb(data)),
});
