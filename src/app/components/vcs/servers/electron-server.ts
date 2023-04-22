import { ipcMain } from "electron"
import { VCSAdapter, AdaptableVCSServer } from "../vcs-provider"

export class ElectronVCSServer<Adapter extends VCSAdapter> extends AdaptableVCSServer<Adapter> {

    public static loadFileChannel = "vcs-load-file"
    public static unloadFileChannel = "vcs-unload-file"
    public static updatePathChannel = "vcs-update-path"
    public static cloneToPathChannel = "vcs-clone-to-path"
    public static createSnapshotChannel = "vcs-create-snapshot"
    public static getSnapshotsChannel = "vcs-get-snapshots"
    public static updateSnapshotChannel = "vcs-update-snapshot"
    public static lineChangedChannel = "vcs-line-changed"
    public static linesChangedChannel = "vcs-lines-Changed"
    public static applyChangeChannel = "vcs-apply-change"
    public static applyChangesChannel = "vcs-apply-changes"
    public static getVersionsChannel = "vcs-get-versions"

    constructor(adapter: Adapter) {
        super(adapter)
        this.mapChannels()
    }

    private mapChannels() {

        const loadFileSubscription = ipcMain.handle(ElectronVCSServer.loadFileChannel, (event, filePath, content) => {
            this.loadFile(filePath, content)
        })

        const unloadFileSubscription = ipcMain.handle(ElectronVCSServer.unloadFileChannel, (event) => {
            this.unloadFile()
        })

        const updatePathSubscription = ipcMain.handle(ElectronVCSServer.updatePathChannel, (event, filePath) => {
            this.updatePath(filePath)
        })

        const cloneToPathSubscription = ipcMain.handle(ElectronVCSServer.cloneToPathChannel, (event, filePath) => {
            this.cloneToPath(filePath)
        })

        const createSnapshotSubscription = ipcMain.handle(ElectronVCSServer.createSnapshotChannel, (event, range) => {
            return this.createSnapshot(range)
        })

        const getSnapshotSubscription = ipcMain.handle(ElectronVCSServer.getSnapshotsChannel, (event) => {
            return this.getSnapshots()
        })

        const updateSnapshotSubscription = ipcMain.handle(ElectronVCSServer.updateSnapshotChannel, (event, snapshot) => {
            this.updateSnapshot(snapshot)
        })

        const lineChangedSubscription = ipcMain.handle(ElectronVCSServer.lineChangedChannel, (event, change) => {
            this.lineChanged(change)
        })

        const linesChangedSubscription = ipcMain.handle(ElectronVCSServer.linesChangedChannel, (event, change) => {
            this.linesChanged(change)
        })

        const applyChangeSubscription = ipcMain.handle(ElectronVCSServer.applyChangeChannel, (event, change) => {
            this.applyChange(change)
        })

        const applyChangesSubscription = ipcMain.handle(ElectronVCSServer.applyChangesChannel, (event, changes) => {
            this.applyChanges(changes)
        })

        const getVersionsSubscription = ipcMain.handle(ElectronVCSServer.getVersionsChannel, (event, snapshot) => {
            this.getVersions(snapshot)
        })
    }
}