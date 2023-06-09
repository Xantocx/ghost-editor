import { ipcRenderer } from "electron"
import { BasicVCSClient, VCSSession, SessionId, SnapshotUUID, Text, VCSClient, SessionOptions, SessionInfo, SessionData } from "../vcs-provider"
import { ElectronVCSServer } from "../servers/electron-server"

import { IRange } from "monaco-editor"
import { Change, ChangeSet, LineChange, MultiLineChange } from "../../data/change"
import { VCSSnapshotData, VCSVersion } from "../../data/snapshot"

function invoke<Type>(channel: string, ...args: any): Promise<Type> {
    return ipcRenderer.invoke(channel, ...args)
}

export const ElectronVCSClient: VCSClient = {

    async startSession(options: SessionOptions): Promise<SessionInfo> {
        return invoke(ElectronVCSServer.startSessionChannel, options)
    },

    async closeSession(sessionId: SessionId): Promise<void> {
        return invoke(ElectronVCSServer.closeSessionChannel, sessionId)
    },

    async updatePath(sessionId: SessionId, filePath: string): Promise<void> {
        return invoke(ElectronVCSServer.updatePathChannel, sessionId, filePath)
    },

    async cloneToPath(sessionId: SessionId, filePath: string): Promise<void> {
        return invoke(ElectronVCSServer.cloneToPathChannel, sessionId, filePath)
    },

    async reloadSessionData(sessionId: SessionId): Promise<SessionData> {
        return invoke(ElectronVCSServer.reloadSessionDataChannel, sessionId)
    },

    async createSnapshot(sessionId: SessionId, range: IRange): Promise<VCSSnapshotData | null> {
        return invoke(ElectronVCSServer.createSnapshotChannel, sessionId, range)
    },

    async deleteSnapshot(sessionId: SessionId, uuid: SnapshotUUID): Promise<void> {
        return invoke(ElectronVCSServer.deleteSnapshotChannel, sessionId, uuid)
    },

    async getSnapshot(sessionId: SessionId, uuid: SnapshotUUID): Promise<VCSSnapshotData> {
        return invoke(ElectronVCSServer.getSnapshotChannel, sessionId, uuid)
    },

    async getSnapshots(sessionId: SessionId): Promise<VCSSnapshotData[]> {
        return invoke(ElectronVCSServer.getSnapshotsChannel, sessionId)
    },

    async updateSnapshot(sessionId: SessionId, snapshot: VCSSnapshotData): Promise<void> {
        return invoke(ElectronVCSServer.updateSnapshotChannel, sessionId, snapshot)
    },

    async applySnapshotVersionIndex(sessionId: SessionId, uuid: SnapshotUUID, versionIndex: number): Promise<Text> {
        return invoke(ElectronVCSServer.applySnapshotVersionIndexChannel, sessionId, uuid, versionIndex)
    },

    async lineChanged(sessionId: SessionId, change: LineChange): Promise<SnapshotUUID[]> {
        return invoke(ElectronVCSServer.lineChangedChannel, sessionId, change)
    },

    async linesChanged(sessionId: SessionId, change: MultiLineChange): Promise<SnapshotUUID[]> {
        return invoke(ElectronVCSServer.linesChangedChannel, sessionId, change)
    },

    async applyChange(sessionId: SessionId, change: Change): Promise<SnapshotUUID[]> {
        return invoke(ElectronVCSServer.applyChangeChannel, sessionId, change)
    },

    async applyChanges(sessionId: SessionId, changes: ChangeSet): Promise<SnapshotUUID[]> {
        return invoke(ElectronVCSServer.applyChangesChannel, sessionId, changes)
    },

    async saveCurrentVersion(sessionId: SessionId, uuid: SnapshotUUID): Promise<VCSVersion> {
        return invoke(ElectronVCSServer.saveCurrentVersionChannel, sessionId, uuid)
    }
}