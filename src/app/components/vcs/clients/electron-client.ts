import { ipcRenderer } from "electron"
import { SnapshotUUID, VCSClient } from "../vcs-provider"
import { ElectronVCSServer } from "../servers/electron-server"

import { IRange } from "monaco-editor"
import { Change, ChangeSet, LineChange, MultiLineChange } from "../../data/change"
import { VCSSnapshotData } from "../../data/snapshot"

function invoke<Type>(channel: string, ...args: any): Promise<Type> {
    return ipcRenderer.invoke(channel, ...args)
}

export const ElectronVCSClient: VCSClient = {
    loadFile(filePath: string | null, eol: string, content: string | null): void {
        invoke(ElectronVCSServer.loadFileChannel, filePath, eol, content)
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

    async createSnapshot(range: IRange): Promise<VCSSnapshotData | null> {
        return invoke(ElectronVCSServer.createSnapshotChannel, range)
    },

    async getSnapshot(uuid: SnapshotUUID): Promise<VCSSnapshotData> {
        return invoke(ElectronVCSServer.getSnapshotChannel, uuid)
    },

    async getSnapshots(): Promise<VCSSnapshotData[]> {
        return invoke(ElectronVCSServer.getSnapshotsChannel)
    },
    
    updateSnapshot(snapshot: VCSSnapshotData): void {
        invoke(ElectronVCSServer.updateSnapshotChannel, snapshot)
    },

    async applySnapshotVersionIndex(uuid: SnapshotUUID, versionIndex: number): Promise<string> {
        return invoke(ElectronVCSServer.applySnapshotVersionIndexChannel, uuid, versionIndex)
    },

    async lineChanged(change: LineChange): Promise<SnapshotUUID[]> {
        return invoke(ElectronVCSServer.lineChangedChannel, change)
    },

    async linesChanged(change: MultiLineChange): Promise<SnapshotUUID[]> {
        return invoke(ElectronVCSServer.linesChangedChannel, change)
    },

    async applyChange(change: Change): Promise<SnapshotUUID[]> {
        return invoke(ElectronVCSServer.applyChangeChannel, change)
    },

    async applyChanges(changes: ChangeSet): Promise<SnapshotUUID[]> {
        return invoke(ElectronVCSServer.applyChangesChannel, changes)
    },

    getVersions(snapshot: VCSSnapshotData) {
        invoke(ElectronVCSServer.getVersionsChannel, snapshot)
    },
}