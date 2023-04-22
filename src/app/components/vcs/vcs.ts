import { ipcRenderer } from "electron"

// ELECTRON VCS ----------------------------------------------------------------------------------
import { VCSProvider } from "./vcs-provider"
import { ElectronVCSProvider } from "./providers/electron-provider"

import { IRange } from "monaco-editor"
import { Change, ChangeSet, LineChange, MultiLineChange } from "../../components/utils/change"
import { VCSAdapterSnapshot } from "../../components/utils/snapshot"

function invoke<Type>(channel: string, ...args: any): Promise<Type> {
    return ipcRenderer.invoke(channel, ...args)
}

export const ElectronVCS: VCSProvider = {
    createAdapter(filePath: string, content: string): void {
        invoke(ElectronVCSProvider.createAdapterChannel, filePath, content)
    },

    dispose(): void {
        invoke(ElectronVCSProvider.disposeChannel)
    },

    async createSnapshot(range: IRange): Promise<VCSAdapterSnapshot> {
        return invoke(ElectronVCSProvider.createSnapshotChannel, range)
    },

    async getSnapshots(): Promise<VCSAdapterSnapshot[]> {
        return invoke(ElectronVCSProvider.getSnapshotsChannel)
    },
    
    updateSnapshot(snapshot: VCSAdapterSnapshot): void {
        invoke(ElectronVCSProvider.updateSnapshotChannel, snapshot)
    },

    lineChanged(change: LineChange): void {
        invoke(ElectronVCSProvider.lineChangedChannel, change)
    },

    linesChanged(change: MultiLineChange): void {
        invoke(ElectronVCSProvider.linesChangedChannel, change)
    },

    applyChange(change: Change): void {
        invoke(ElectronVCSProvider.applyChangeChannel, change)
    },

    applyChanges(changes: ChangeSet): void {
        invoke(ElectronVCSProvider.applyChangesChannel, changes)
    },

    update(filePath: string): void {
        invoke(ElectronVCSProvider.updateChannel, filePath)
    },
}