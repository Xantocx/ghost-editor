import { ipcMain } from "electron"
import { IRange } from "monaco-editor"
import { VCSAdapterSnapshot } from "./utils/snapshot"
import { ChangeSet, LineChange, MultiLineChange, AnyChange, ChangeBehaviour } from "./utils/change"

export interface VCSAdapterClass<Adapter extends VCSAdapter> {
    new(filePath: string | null, content: string | null): Adapter
}

export interface VCSAdapter {

    // versions interface
    createSnapshot(range: IRange): Promise<VCSAdapterSnapshot>
    getSnapshots(): Promise<VCSAdapterSnapshot[]>
    updateSnapshot(snapshot: VCSAdapterSnapshot): void

    // modification interface
    lineChanged(change: LineChange): void
    linesChanged(change: MultiLineChange): void

    update(filePath: string): void  // update path of the file handled by this adapter
    dispose(): void                 // won't capture any changes anymore
}

export interface IGhostVCSProvider extends VCSAdapter {
    createAdapter(filePath: string | null, content: string | null): void
    applyChange(change: AnyChange): void
    applyChanges(changes: ChangeSet): void
}

export class GhostVCSProvider<Adapter extends VCSAdapter> implements IGhostVCSProvider {

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

    private readonly adapterClass: VCSAdapterClass<Adapter>
    
    private _adapter: Adapter | null = null
    public get adapter(): Adapter | null {
        return this._adapter
    }

    private set adapter(adapter: Adapter | null) {
        this._adapter = adapter
    }

    constructor(adaptorClass: VCSAdapterClass<Adapter>) {
        this.adapterClass = adaptorClass
        this.mapChannels()
    }

    private mapChannels() {
        const createAdapterSubscription = ipcMain.handle(GhostVCSProvider.createAdapterChannel, (event, filePath, content) => {
            this.createAdapter(filePath, content)
        })

        const disposeSubscription = ipcMain.handle(GhostVCSProvider.disposeChannel, (event) => {
            this.dispose()
        })

        const createSnapshotSubscription = ipcMain.handle(GhostVCSProvider.createSnapshotChannel, (event, range) => {
            return this.createSnapshot(range)
        })

        const getSnapshotSubscription = ipcMain.handle(GhostVCSProvider.getSnapshotsChannel, (event) => {
            return this.getSnapshots()
        })

        const updateSnapshotSubscription = ipcMain.handle(GhostVCSProvider.updateSnapshotChannel, (event, snapshot) => {
            this.updateSnapshot(snapshot)
        })

        const lineChangedSubscription = ipcMain.handle(GhostVCSProvider.lineChangedChannel, (event, change) => {
            this.lineChanged(change)
        })

        const linesChangedSubscription = ipcMain.handle(GhostVCSProvider.linesChangedChannel, (event, change) => {
            this.linesChanged(change)
        })

        const applyChangeSubscription = ipcMain.handle(GhostVCSProvider.applyChangeChannel, (event, change) => {
            this.applyChange(change)
        })

        const applyChangesSubscription = ipcMain.handle(GhostVCSProvider.applyChangesChannel, (event, changes) => {
            this.applyChanges(changes)
        })

        const updateSubscription = ipcMain.handle(GhostVCSProvider.updateChannel, (event, filePath) => {
            this.update(filePath)
        })
    }

    public createAdapter(filePath: string | null, content: string | null): void {
        this.dispose()
        this.adapter = new this.adapterClass(filePath, content)
    }

    public dispose() {
        this.adapter?.dispose()
        this.adapter = null
    }

    public createSnapshot(range: IRange): Promise<VCSAdapterSnapshot> {
        return this.adapter?.createSnapshot(range)
    }

    public getSnapshots(): Promise<VCSAdapterSnapshot[]> {
        return this.adapter!.getSnapshots()
    }

    public updateSnapshot(snapshot: VCSAdapterSnapshot): void {
        return this.adapter?.updateSnapshot(snapshot)
    }

    public lineChanged(change: LineChange): void {
        this.adapter?.lineChanged(change)
    }

    public linesChanged(change: MultiLineChange): void {
        this.adapter?.linesChanged(change)
    }

    public applyChange(change: AnyChange): void {
        if (change.changeBehaviour === ChangeBehaviour.Line) {
            this.lineChanged(change as LineChange)
        } else if (change.changeBehaviour === ChangeBehaviour.MultiLine) {
            this.linesChanged(change as MultiLineChange)
        } else {
            throw new Error("Change type unknown.")
        }
    }

    public applyChanges(changes: ChangeSet): void {
        changes.forEach(change => {
            this.applyChange(change)
        })
    }

    public update(filePath: string): void {
        this.adapter?.update(filePath)
    }
}