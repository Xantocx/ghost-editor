import { ipcMain } from "electron"
import { VCSAdapter, AdaptableVCSServer, VersionUUID, SnapshotUUID, Text } from "../vcs-provider"
import { IRange } from "../../../../editor/utils/types"
import { VCSSnapshotData } from "../../data/snapshot"
import { AnyChange, ChangeSet, LineChange, MultiLineChange } from "../../data/change"

export class ElectronVCSServer<Adapter extends VCSAdapter> extends AdaptableVCSServer<Adapter> {

    public static loadFileChannel = "vcs-load-file"
    public static unloadFileChannel = "vcs-unload-file"
    public static updatePathChannel = "vcs-update-path"
    public static cloneToPathChannel = "vcs-clone-to-path"
    public static createSnapshotChannel = "vcs-create-snapshot"
    public static deleteSnapshotChannel = "vcs-delete-snapshot"
    public static getSnapshotChannel = "vcs-get-snapshot"
    public static getSnapshotsChannel = "vcs-get-snapshots"
    public static updateSnapshotChannel = "vcs-update-snapshot"
    public static applySnapshotVersionIndexChannel = "vcs-apply-snapshot-version-index"
    public static lineChangedChannel = "vcs-line-changed"
    public static linesChangedChannel = "vcs-lines-Changed"
    public static applyChangeChannel = "vcs-apply-change"
    public static applyChangesChannel = "vcs-apply-changes"
    public static saveCurrentVersionChannel = "vcs-save-current-version"

    constructor(adapter: Adapter) {
        super(adapter)
        this.mapChannels()
    }

    private mapChannels() {

        const loadFileSubscription = ipcMain.handle(ElectronVCSServer.loadFileChannel, (event, filePath: string, eol: string, content: Text) => {
            this.loadFile(filePath, eol, content)
        })

        const unloadFileSubscription = ipcMain.handle(ElectronVCSServer.unloadFileChannel, (event) => {
            this.unloadFile()
        })

        const updatePathSubscription = ipcMain.handle(ElectronVCSServer.updatePathChannel, (event, filePath: string) => {
            this.updatePath(filePath)
        })

        const cloneToPathSubscription = ipcMain.handle(ElectronVCSServer.cloneToPathChannel, (event, filePath: string) => {
            this.cloneToPath(filePath)
        })

        const createSnapshotSubscription = ipcMain.handle(ElectronVCSServer.createSnapshotChannel, (event, range: IRange) => {
            return this.createSnapshot(range)
        })

        const deleteSnapshotSubscription = ipcMain.handle(ElectronVCSServer.deleteSnapshotChannel, (event, uuid: SnapshotUUID) => {
            return this.deleteSnapshot(uuid)
        })

        const getSnapshotSubscription = ipcMain.handle(ElectronVCSServer.getSnapshotChannel, (event, uuid: SnapshotUUID) => {
            return this.getSnapshot(uuid)
        })

        const getSnapshotsSubscription = ipcMain.handle(ElectronVCSServer.getSnapshotsChannel, (event) => {
            return this.getSnapshots()
        })

        const updateSnapshotSubscription = ipcMain.handle(ElectronVCSServer.updateSnapshotChannel, (event, snapshot: VCSSnapshotData) => {
            this.updateSnapshot(snapshot)
        })

        const applySnapshotVersionIndexSubscription = ipcMain.handle(ElectronVCSServer.applySnapshotVersionIndexChannel, (event, uuid: SnapshotUUID, versionIndex: number) => {
            return this.applySnapshotVersionIndex(uuid, versionIndex)
        })

        const lineChangedSubscription = ipcMain.handle(ElectronVCSServer.lineChangedChannel, (event, change: LineChange) => {
            return this.lineChanged(change)
        })

        const linesChangedSubscription = ipcMain.handle(ElectronVCSServer.linesChangedChannel, (event, change: MultiLineChange) => {
            return this.linesChanged(change)
        })

        const applyChangeSubscription = ipcMain.handle(ElectronVCSServer.applyChangeChannel, (event, change: AnyChange) => {
            return this.applyChange(change)
        })

        const applyChangesSubscription = ipcMain.handle(ElectronVCSServer.applyChangesChannel, (event, changes: ChangeSet) => {
            return this.applyChanges(changes)
        })

        const saveCurrentVersionSubscription = ipcMain.handle(ElectronVCSServer.saveCurrentVersionChannel, (event, uuid: VersionUUID) => {
            return this.saveCurrentVersion(uuid)
        })
    }
}