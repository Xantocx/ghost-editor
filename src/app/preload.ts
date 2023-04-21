// ContextBridge: https://github.com/electron/electron/issues/9920#issuecomment-468323625
// TypeScript:    https://github.com/electron/electron/issues/9920#issuecomment-468323625
import { contextBridge, ipcRenderer } from "electron"

import { IRange } from "monaco-editor"
import { GhostVCSProvider } from "./components/vcs-provider"
import { Change, ChangeSet, LineChange, MultiLineChange } from "./components/utils/change"
import { VCSAdapterSnapshot } from "./components/utils/snapshot"

function invoke<Type>(channel: string, ...args: any): Promise<Type> {
    return ipcRenderer.invoke(channel, ...args)
}

contextBridge.exposeInMainWorld("ipcRenderer", {
    invoke: (channel: string, ...args: any)                 => ipcRenderer.invoke(channel, ...args),
    on:     (channel: string, func: (...args: any) => void) => ipcRenderer.on(channel, (event, ...args) => func(...args))
})

contextBridge.exposeInMainWorld("vcs", {
    createAdapter(filePath: string, content: string): void {
        invoke(GhostVCSProvider.createAdapterChannel, filePath, content)
    },

    dispose(): void {
        invoke(GhostVCSProvider.disposeChannel)
    },

    async createSnapshot(range: IRange): Promise<VCSAdapterSnapshot> {
        return invoke(GhostVCSProvider.createSnapshotChannel, range)
    },

    async getSnapshots(): Promise<VCSAdapterSnapshot[]> {
        return invoke(GhostVCSProvider.getSnapshotsChannel)
    },
    
    updateSnapshot(snapshot: VCSAdapterSnapshot): void {
        invoke(GhostVCSProvider.updateSnapshotChannel, snapshot)
    },

    lineChanged(change: LineChange): void {
        invoke(GhostVCSProvider.lineChangedChannel, change)
    },

    linesChanged(change: MultiLineChange): void {
        invoke(GhostVCSProvider.linesChangedChannel, change)
    },

    applyChange(change: Change): void {
        invoke(GhostVCSProvider.applyChangeChannel, change)
    },

    applyChanges(changes: ChangeSet): void {
        invoke(GhostVCSProvider.applyChangesChannel, changes)
    },

    update(filePath: string): void {
        invoke(GhostVCSProvider.updateChannel, filePath)
    },
})