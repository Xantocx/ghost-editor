import { IRange } from "monaco-editor"
import { VCSSnapshotData } from "../data/snapshot"
import { ChangeSet, LineChange, MultiLineChange, AnyChange, ChangeBehaviour } from "../data/change"

// functionality that the VCS needs to provide
export interface VCSProvider {
    // file handling
    loadFile(filePath: string | null, content: string | null): void
    unloadFile(): void
    updatePath(filePath: string): void
    cloneToPath(filePath: string): void

    // snapshot interface
    createSnapshot(range: IRange): Promise<VCSSnapshotData>
    getSnapshots(): Promise<VCSSnapshotData[]>
    updateSnapshot(snapshot: VCSSnapshotData): void

    // modification interface
    lineChanged(change: LineChange): void
    linesChanged(change: MultiLineChange): void
    applyChange(change: AnyChange): void
    applyChanges(changes: ChangeSet): void

    // version interface
    getVersions(snapshot: VCSSnapshotData): void
}

export abstract class BasicVCSProvider implements VCSProvider {

    public loadFile(filePath: string | null, content: string | null): void {
        throw new Error("Method not implemented.")
    }

    public unloadFile(): void {
        throw new Error("Method not implemented.")
    }

    public updatePath(filePath: string): void {
        throw new Error("Method not implemented.")
    }

    public cloneToPath(filePath: string): void {
        throw new Error("Method not implemented.")
    }

    public createSnapshot(range: IRange): Promise<VCSSnapshotData> {
        throw new Error("Method not implemented.")
    }

    public getSnapshots(): Promise<VCSSnapshotData[]> {
        throw new Error("Method not implemented.")
    }

    public updateSnapshot(snapshot: VCSSnapshotData): void {
        throw new Error("Method not implemented.")
    }

    public lineChanged(change: LineChange): void {
        throw new Error("Method not implemented.")
    }

    public linesChanged(change: MultiLineChange): void {
        throw new Error("Method not implemented.")
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

    public getVersions(snapshot: VCSSnapshotData): void {
        throw new Error("Method not implemented.")
    }
}

// server-side interface on which end-points may be mapped
export interface VCSServer extends VCSProvider {}
export abstract class BasicVCSServer extends BasicVCSProvider implements VCSServer {}

// client-side interface which may call server end-points
export interface VCSClient extends VCSProvider {}
export abstract class BasicVCSClient extends BasicVCSProvider implements VCSClient {}

// adapter that allows to build an adaptable server with varying backend
export interface VCSAdapter extends VCSProvider {}
export abstract class BasicVCSAdapter extends BasicVCSProvider implements VCSAdapter {}

// support interface to allow for constructor typing of adapters
export interface VCSAdapterClass<Adapter extends VCSAdapter> {
    new(): Adapter
}

// adaptable server with varying backend implemented as an adapter
export class AdaptableVCSServer<Adapter extends VCSAdapter> extends BasicVCSProvider implements VCSServer {
    
    public readonly adapter: Adapter

    public static create<Adapter extends VCSAdapter>(adapterClass: VCSAdapterClass<Adapter>): AdaptableVCSServer<Adapter> {
        const adapter = new adapterClass()
        return new this(adapter)
    }

    constructor(adapter: Adapter) {
        super()
        this.adapter = adapter
    }

    public loadFile(filePath: string | null, content: string | null): void {
        this.adapter.loadFile(filePath, content)
    }

    public unloadFile(): void {
        this.adapter.unloadFile()
    }

    public updatePath(filePath: string): void {
        this.adapter.updatePath(filePath)
    }

    public cloneToPath(filePath: string): void {
        this.adapter.cloneToPath(filePath)
    }

    public async createSnapshot(range: IRange): Promise<VCSSnapshotData> {
        return this.adapter.createSnapshot(range)
    }

    public async getSnapshots(): Promise<VCSSnapshotData[]> {
        return this.adapter.getSnapshots()
    }

    public updateSnapshot(snapshot: VCSSnapshotData): void {
        this.adapter.updateSnapshot(snapshot)
    }

    public lineChanged(change: LineChange): void {
        this.adapter.lineChanged(change)
    }

    public linesChanged(change: MultiLineChange): void {
        this.adapter.linesChanged(change)
    }

    public getVersions(snapshot: VCSSnapshotData): void {
        this.adapter.getVersions(snapshot)
    }
}