const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('heliosAPI', {
  saveReadings: (readings) => ipcRenderer.invoke('save-readings', readings),
  getReadings: (date) => ipcRenderer.invoke('get-readings', date),
  getDates: () => ipcRenderer.invoke('get-dates'),
})
