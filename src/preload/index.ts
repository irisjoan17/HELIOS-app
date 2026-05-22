import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('heliosAPI', {
  saveReadings: (readings: unknown[]) => ipcRenderer.invoke('save-readings', readings),
  getReadings: (date: string) => ipcRenderer.invoke('get-readings', date),
  getDates: () => ipcRenderer.invoke('get-dates'),
})
