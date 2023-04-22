import { ipcRenderer } from "electron"
import { VCSClient } from "../vcs-provider"
import { ElectronVCSServer } from "../servers/electron-server"

import { IRange } from "monaco-editor"
import { Change, ChangeSet, LineChange, MultiLineChange } from "../../data/change"
import { VCSSnapshotData } from "../../data/snapshot"

function invoke<Type>(channel: string, ...args: any): Promise<Type> {
    return ipcRenderer.invoke(channel, ...args)
}

export const ElectronVCSClient: VCSClient = {
    loadFile(filePath: string | null, content: string | null): void {
        invoke(ElectronVCSServer.loadFileChannel, filePath, content)
    },

    unloadFile(): void {
        invoke(ElectronVCSServer.unloadFileChannel)
    },

    updatePath(filePath: string): void {
        invoke(ElectronVCSServer.updatePathChannel, filePath)
    },

    cloneToPath(filePath: string): void {
        invoke(ElectronVCSServer.cloneToPathChannel, filePath)
    },

    async createSnapshot(range: IRange): Promise<VCSSnapshotData> {
        return invoke(ElectronVCSServer.createSnapshotChannel, range)
    },

    async getSnapshots(): Promise<VCSSnapshotData[]> {
        return invoke(ElectronVCSServer.getSnapshotsChannel)
    },
    
    updateSnapshot(snapshot: VCSSnapshotData): void {
        invoke(ElectronVCSServer.updateSnapshotChannel, snapshot)
    },

    lineChanged(change: LineChange): void {
        invoke(ElectronVCSServer.lineChangedChannel, change)
    },

    linesChanged(change: MultiLineChange): void {
        invoke(ElectronVCSServer.linesChangedChannel, change)
    },

    applyChange(change: Change): void {
        invoke(ElectronVCSServer.applyChangeChannel, change)
    },

    applyChanges(changes: ChangeSet): void {
        invoke(ElectronVCSServer.applyChangesChannel, changes)
    },

    getVersions(snapshot: VCSSnapshotData) {
        invoke(ElectronVCSServer.getVersionsChannel, snapshot)
    },
}