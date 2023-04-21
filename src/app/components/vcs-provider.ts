import { VCSSnapshot } from "./utils/snapshot"
import { Change, ChangeSet, LineChange, MultiLineChange } from "./utils/change"

export interface VCSAdapterClass<Adapter extends VCSAdapter> {
    new(filePath: string | null, content: string | null): Adapter
}

export interface VCSAdapter {

    get filePath(): string | null

    // versions interface
    getSnapshots(): VCSSnapshot[]
    addSnapshot(snapshot: VCSSnapshot): void
    updateSnapshot(snapshot: VCSSnapshot): void

    // modification interface
    lineChanged(change: LineChange): void
    linesChanged(change: MultiLineChange): void

    update(filePath: string): void  // update path of the file handled by this adapter
    dispose(): void                 // won't capture any changes anymore
}

export class GhostVCSProvider<Adapter extends VCSAdapter> implements VCSAdapter {

    private readonly adapterClass: VCSAdapterClass<Adapter>
    
    private _adapter: Adapter | null = null
    public get adapter(): Adapter | null {
        return this._adapter
    }

    private set adapter(adapter: Adapter | null) {
        this._adapter = adapter
    }

    public get filePath(): string | null {
        return this.adapter.filePath
    }

    constructor(adaptorClass: VCSAdapterClass<Adapter>) {
        this.adapterClass = adaptorClass
    }

    public createAdapter(filePath: string | null, content: string | null) {
        this.dispose()
        this.adapter = new this.adapterClass(filePath, content)
    }

    public dispose() {
        this.adapter?.dispose()
        this.adapter = null
    }

    public getSnapshots(): VCSSnapshot[] {
        return this.adapter!.getSnapshots()
    }

    public addSnapshot(snapshot: VCSSnapshot): void {
        return this.adapter?.addSnapshot(snapshot)
    }

    public updateSnapshot(snapshot: VCSSnapshot): void {
        return this.adapter?.updateSnapshot(snapshot)
    }

    public lineChanged(change: LineChange): void {
        this.adapter?.lineChanged(change)
    }

    public linesChanged(change: MultiLineChange): void {
        this.adapter?.linesChanged(change)
    }

    public applyChange(change: Change): void {
        if (change instanceof LineChange) {
            this.lineChanged(change)
        } else if (change instanceof MultiLineChange) {
            this.linesChanged(change)
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