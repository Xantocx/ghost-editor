import { IRange } from "monaco-editor"
import { VCSAdapterSnapshot } from "../utils/snapshot"
import { ChangeSet, LineChange, MultiLineChange, AnyChange, ChangeBehaviour } from "../utils/change"

// support interface to allow for constructor typing of adapters
export interface VCSServerClass<Adapter extends VCSServer> {
    new(filePath: string | null, content: string | null): Adapter
}

// server-side interface interacting with databases, etc. and providing an interface for ghost
export interface VCSServer {

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

// client-side interface allowing the client to call server-side functions + some convenience
export interface VCSClient extends VCSServer {
    createAdapter(filePath: string | null, content: string | null): void
    applyChange(change: AnyChange): void
    applyChanges(changes: ChangeSet): void
}

export class GhostVCSProvider<Adapter extends VCSServer> implements VCSClient {

    private readonly adapterClass: VCSServerClass<Adapter>
    
    private _adapter: Adapter | null = null
    public get adapter(): Adapter | null {
        return this._adapter
    }

    private set adapter(adapter: Adapter | null) {
        this._adapter = adapter
    }

    constructor(adaptorClass: VCSServerClass<Adapter>) {
        this.adapterClass = adaptorClass
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