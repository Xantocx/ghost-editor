import { ipcMain } from "electron"
import { VCSAdapter, VCSAdapterClass, GhostVCSProvider } from "../vcs-provider"

export class ElectronVCSProvider<Adapter extends VCSAdapter> extends GhostVCSProvider<Adapter> {

    public static createAdapterChannel = "vcs-create-adapter"
    public static disposeChannel = "vcs-dispose"
    public static createSnapshotChannel = "vcs-create-snapshot"
    public static getSnapshotsChannel = "vcs-get-snapshots"
    public static updateSnapshotChannel = "vcs-update-snapshot"
    public static lineChangedChannel = "vcs-line-changed"
    public static linesChangedChannel = "vcs-lines-Changed"
    public static applyChangeChannel = "vcs-apply-change"
    public static applyChangesChannel = "vcs-apply-changes"
    public static updateChannel = "vcs-update"

    constructor(adaptorClass: VCSAdapterClass<Adapter>) {
        super(adaptorClass)
        this.mapChannels()
    }

    private mapChannels() {
        const createAdapterSubscription = ipcMain.handle(ElectronVCSProvider.createAdapterChannel, (event, filePath, content) => {
            this.createAdapter(filePath, content)
        })

        const disposeSubscription = ipcMain.handle(ElectronVCSProvider.disposeChannel, (event) => {
            this.dispose()
        })

        const createSnapshotSubscription = ipcMain.handle(ElectronVCSProvider.createSnapshotChannel, (event, range) => {
            return this.createSnapshot(range)
        })

        const getSnapshotSubscription = ipcMain.handle(ElectronVCSProvider.getSnapshotsChannel, (event) => {
            return this.getSnapshots()
        })

        const updateSnapshotSubscription = ipcMain.handle(ElectronVCSProvider.updateSnapshotChannel, (event, snapshot) => {
            this.updateSnapshot(snapshot)
        })

        const lineChangedSubscription = ipcMain.handle(ElectronVCSProvider.lineChangedChannel, (event, change) => {
            this.lineChanged(change)
        })

        const linesChangedSubscription = ipcMain.handle(ElectronVCSProvider.linesChangedChannel, (event, change) => {
            this.linesChanged(change)
        })

        const applyChangeSubscription = ipcMain.handle(ElectronVCSProvider.applyChangeChannel, (event, change) => {
            this.applyChange(change)
        })

        const applyChangesSubscription = ipcMain.handle(ElectronVCSProvider.applyChangesChannel, (event, changes) => {
            this.applyChanges(changes)
        })

        const updateSubscription = ipcMain.handle(ElectronVCSProvider.updateChannel, (event, filePath) => {
            this.update(filePath)
        })
    }
}