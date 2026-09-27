// Narrow bridge: the page can fetch the screenshot, read the app version, open
// a feedback email draft (validated in main), and ask to quit. Nothing else.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('__SMASH_DESKTOP__', {
  shot: () => ipcRenderer.invoke('smash:shot'),
  quit: () => ipcRenderer.send('smash:quit'),
  info: () => ipcRenderer.invoke('smash:info'),
  mail: (url) => ipcRenderer.send('smash:mail', url),
});
