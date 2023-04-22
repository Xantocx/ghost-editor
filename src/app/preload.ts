// ContextBridge: https://github.com/electron/electron/issues/9920#issuecomment-468323625
// TypeScript:    https://github.com/electron/electron/issues/9920#issuecomment-468323625
import { contextBridge, ipcRenderer } from "electron"
import { ElectronVCS } from "./components/vcs/vcs"

// set ipc renderer for render environment
contextBridge.exposeInMainWorld("ipcRenderer", {
    invoke: (channel: string, ...args: any)                 => ipcRenderer.invoke(channel, ...args),
    on:     (channel: string, func: (...args: any) => void) => ipcRenderer.on(channel, (event, ...args) => func(...args))
})

// set vcs for render environment
contextBridge.exposeInMainWorld("vcs", ElectronVCS)