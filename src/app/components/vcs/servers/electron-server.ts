import { ipcMain } from "electron"
import { VCSAdapter, AdaptableVCSServer, TagId, SnapshotUUID, Text, SessionOptions, SessionId } from "../vcs-provider"
import { IRange } from "../../../../editor/utils/types"
import { VCSSnapshotData } from "../../data/snapshot"
import { AnyChange, ChangeSet, LineChange, MultiLineChange } from "../../data/change"

export class ElectronVCSServer<Adapter extends VCSAdapter> extends AdaptableVCSServer<Adapter> {

    public static startSessionChannel              = "vcs-start-session"
    public static closeSessionChannel              = "vcs-close-session"
    public static reloadSessionDataChannel         = "vcs-reload-session-data"
    public static updatePathChannel                = "vcs-update-path"
    public static cloneToPathChannel               = "vcs-clone-to-path"
    public static createSnapshotChannel            = "vcs-create-snapshot"
    public static deleteSnapshotChannel            = "vcs-delete-snapshot"
    public static getSnapshotChannel               = "vcs-get-snapshot"
    public static getSnapshotsChannel              = "vcs-get-snapshots"
    public static updateSnapshotChannel            = "vcs-update-snapshot"
    public static applySnapshotVersionIndexChannel = "vcs-apply-snapshot-version-index"
    public static lineChangedChannel               = "vcs-line-changed"
    public static linesChangedChannel              = "vcs-lines-Changed"
    public static applyChangeChannel               = "vcs-apply-change"
    public static applyChangesChannel              = "vcs-apply-changes"
    public static saveCurrentVersionChannel        = "vcs-save-current-version"

    constructor(adapter: Adapter) {
        super(adapter)
        this.mapChannels()
    }

    private mapChannels() {

        const startSessionSubscription = ipcMain.handle(ElectronVCSServer.startSessionChannel, async (event, eol: string, options?: SessionOptions) => {
            return this.startSession(eol, options)
        })

        const closeSessionSubscription = ipcMain.handle(ElectronVCSServer.closeSessionChannel, async (event, sessionId: SessionId) => {
            return this.closeSession(sessionId)
        })

        const reloadSessionDataSubscription = ipcMain.handle(ElectronVCSServer.reloadSessionDataChannel, async (event, sessionId: SessionId) => {
            return this.reloadSessionData(sessionId)
        })

        const updatePathSubscription = ipcMain.handle(ElectronVCSServer.updatePathChannel, async (event, sessionId: SessionId, filePath: string) => {
            return this.updatePath(sessionId, filePath)
        })

        const cloneToPathSubscription = ipcMain.handle(ElectronVCSServer.cloneToPathChannel, async (event, sessionId: SessionId, filePath: string) => {
            return this.cloneToPath(sessionId, filePath)
        })

        const createSnapshotSubscription = ipcMain.handle(ElectronVCSServer.createSnapshotChannel, async (event, sessionId: SessionId, range: IRange) => {
            return this.createSnapshot(sessionId, range)
        })

        const deleteSnapshotSubscription = ipcMain.handle(ElectronVCSServer.deleteSnapshotChannel, async (event, sessionId: SessionId, uuid: SnapshotUUID) => {
            return this.deleteSnapshot(sessionId, uuid)
        })

        const getSnapshotSubscription = ipcMain.handle(ElectronVCSServer.getSnapshotChannel, async (event, sessionId: SessionId, uuid: SnapshotUUID) => {
            return this.getSnapshot(sessionId, uuid)
        })

        const getSnapshotsSubscription = ipcMain.handle(ElectronVCSServer.getSnapshotsChannel, async (event, sessionId: SessionId) => {
            return this.getSnapshots(sessionId)
        })

        const updateSnapshotSubscription = ipcMain.handle(ElectronVCSServer.updateSnapshotChannel, async (event, sessionId: SessionId, snapshot: VCSSnapshotData) => {
            this.updateSnapshot(sessionId, snapshot)
        })

        const applySnapshotVersionIndexSubscription = ipcMain.handle(ElectronVCSServer.applySnapshotVersionIndexChannel, async (event, sessionId: SessionId, uuid: SnapshotUUID, versionIndex: number) => {
            return this.applySnapshotVersionIndex(sessionId, uuid, versionIndex)
        })

        const lineChangedSubscription = ipcMain.handle(ElectronVCSServer.lineChangedChannel, async (event, sessionId: SessionId, change: LineChange) => {
            return this.lineChanged(sessionId, change)
        })

        const linesChangedSubscription = ipcMain.handle(ElectronVCSServer.linesChangedChannel, async (event, sessionId: SessionId, change: MultiLineChange) => {
            return this.linesChanged(sessionId, change)
        })

        const applyChangeSubscription = ipcMain.handle(ElectronVCSServer.applyChangeChannel, async (event, sessionId: SessionId, change: AnyChange) => {
            return this.applyChange(sessionId, change)
        })

        const applyChangesSubscription = ipcMain.handle(ElectronVCSServer.applyChangesChannel, async (event, sessionId: SessionId, changes: ChangeSet) => {
            return this.applyChanges(sessionId, changes)
        })

        const saveCurrentVersionSubscription = ipcMain.handle(ElectronVCSServer.saveCurrentVersionChannel, async (event, sessionId: SessionId, uuid: TagId) => {
            return this.saveCurrentVersion(sessionId, uuid)
        })
    }
}