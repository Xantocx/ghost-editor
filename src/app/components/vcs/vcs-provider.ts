import { IRange } from "monaco-editor"
import { VCSSnapshotData } from "../data/snapshot"
import { ChangeSet, LineChange, MultiLineChange, AnyChange, ChangeBehaviour } from "../data/change"

export type Text = string
export type SnapshotUUID = string

// functionality that the VCS needs to provide
export interface VCSProvider {
    // file handling
    loadFile(filePath: string | null, eol: string, content: string | null): void
    unloadFile(): void
    updatePath(filePath: string): void
    cloneToPath(filePath: string): void

    // snapshot interface
    createSnapshot(range: IRange): Promise<VCSSnapshotData | null>
    getSnapshot(uuid: string): Promise<VCSSnapshotData>
    getSnapshots(): Promise<VCSSnapshotData[]>
    updateSnapshot(snapshot: VCSSnapshotData): void
    applySnapshotVersionIndex(uuid: SnapshotUUID, versionIndex: number): Promise<Text>

    // modification interface
    lineChanged(change: LineChange): Promise<SnapshotUUID[]>
    linesChanged(change: MultiLineChange): Promise<SnapshotUUID[]>
    applyChange(change: AnyChange): Promise<SnapshotUUID[]>
    applyChanges(changes: ChangeSet): Promise<SnapshotUUID[]>

    // version interface
    getVersions(snapshot: VCSSnapshotData): void
}

export abstract class BasicVCSProvider implements VCSProvider {

    public loadFile(filePath: string | null, eol: string, content: string | null): void {
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

    public createSnapshot(range: IRange): Promise<VCSSnapshotData | null> {
        throw new Error("Method not implemented.")
    }

    getSnapshot(uuid: string): Promise<VCSSnapshotData> {
        throw new Error("Method not implemented.")
    }

    public getSnapshots(): Promise<VCSSnapshotData[]> {
        throw new Error("Method not implemented.")
    }

    public updateSnapshot(snapshot: VCSSnapshotData): void {
        throw new Error("Method not implemented.")
    }

    public applySnapshotVersionIndex(uuid: SnapshotUUID, versionIndex: number): Promise<Text> {
        throw new Error("Method not implemented.")
    }

    public async lineChanged(change: LineChange): Promise<SnapshotUUID[]> {
        throw new Error("Method not implemented.")
    }

    public async linesChanged(change: MultiLineChange): Promise<SnapshotUUID[]> {
        throw new Error("Method not implemented.")
    }

    public async applyChange(change: AnyChange): Promise<SnapshotUUID[]> {
        if (change.changeBehaviour === ChangeBehaviour.Line) {
            return this.lineChanged(change as LineChange)
        } else if (change.changeBehaviour === ChangeBehaviour.MultiLine) {
            return this.linesChanged(change as MultiLineChange)
        } else {
            throw new Error("Change type unknown.")
        }
    }

    public async applyChanges(changes: ChangeSet): Promise<SnapshotUUID[]> {
        // WARNING: async forEach is completely fucked
        const uuids = []
        for (let i = 0; i < changes.length; i++) {
            uuids.push(await this.applyChange(changes[i]))
        }
        return uuids.flat()
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

    public loadFile(filePath: string | null, eol: string, content: string | null): void {
        this.adapter.loadFile(filePath, eol, content)
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

    public async createSnapshot(range: IRange): Promise<VCSSnapshotData | null> {
        return this.adapter.createSnapshot(range)
    }

    public async getSnapshot(uuid: string): Promise<VCSSnapshotData> {
        return this.adapter.getSnapshot(uuid)
    }

    public async getSnapshots(): Promise<VCSSnapshotData[]> {
        return this.adapter.getSnapshots()
    }

    public updateSnapshot(snapshot: VCSSnapshotData): void {
        this.adapter.updateSnapshot(snapshot)
    }

    public async applySnapshotVersionIndex(uuid: SnapshotUUID, versionIndex: number): Promise<Text> {
        return this.adapter.applySnapshotVersionIndex(uuid, versionIndex)
    }

    public async lineChanged(change: LineChange): Promise<SnapshotUUID[]> {
        return this.adapter.lineChanged(change)
    }

    public async linesChanged(change: MultiLineChange): Promise<SnapshotUUID[]> {
        return this.adapter.linesChanged(change)
    }

    public getVersions(snapshot: VCSSnapshotData): void {
        this.adapter.getVersions(snapshot)
    }
}