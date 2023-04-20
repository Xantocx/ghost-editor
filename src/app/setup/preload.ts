// ContextBridge: https://github.com/electron/electron/issues/9920#issuecomment-468323625
// TypeScript:    https://github.com/electron/electron/issues/9920#issuecomment-468323625
import { contextBridge, ipcRenderer } from "electron"

contextBridge.exposeInMainWorld('ipcRenderer', {
    invoke: (channel: string, ...args: any)                 => ipcRenderer.invoke(channel, ...args),
    on:     (channel: string, func: (...args: any) => void) => ipcRenderer.on(channel, (event, ...args) => func(...args))
})