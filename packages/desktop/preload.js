// Narrow bridge: the page can fetch the screenshot and ask to quit. Nothing else.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('__SMASH_DESKTOP__', {
  shot: () => ipcRenderer.invoke('smash:shot'),
  quit: () => ipcRenderer.send('smash:quit'),
});
