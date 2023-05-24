import { IRange } from "monaco-editor"
import { VCSSnapshotData, VCSVersion } from "../data/snapshot"
import { ChangeSet, LineChange, MultiLineChange, AnyChange, ChangeBehaviour } from "../data/change"

export type Text = string
export type SnapshotUUID = string
export type VersionUUID  = string
export type SessionId    = string

// functionality that the VCS needs to provide
export interface VCSProvider {

    // file handling
    startSession(eol: string, options?: { filePath?: string, content?: string }): Promise<{ sessionId: SessionId, blockId: string, content: string }>
    closeSession(sessionId: SessionId): Promise<void>

    updatePath(sessionId: SessionId, filePath: string): Promise<void>
    cloneToPath(sessionId: SessionId, filePath: string): Promise<void>

    // snapshot interface
    createSnapshot(sessionId: SessionId, range: IRange): Promise<VCSSnapshotData | null>
    deleteSnapshot(sessionId: SessionId, uuid: SnapshotUUID): Promise<void>
    getSnapshot(sessionId: SessionId, uuid: SnapshotUUID): Promise<VCSSnapshotData>
    getSnapshots(sessionId: SessionId): Promise<VCSSnapshotData[]>
    updateSnapshot(sessionId: SessionId, snapshot: VCSSnapshotData): Promise<void>
    applySnapshotVersionIndex(sessionId: SessionId, uuid: SnapshotUUID, versionIndex: number): Promise<Text>

    // modification interface
    lineChanged(sessionId: SessionId, change: LineChange): Promise<SnapshotUUID[]>
    linesChanged(sessionId: SessionId, change: MultiLineChange): Promise<SnapshotUUID[]>
    applyChange(sessionId: SessionId, change: AnyChange): Promise<SnapshotUUID[]>
    applyChanges(sessionId: SessionId, changes: ChangeSet): Promise<SnapshotUUID[]>

    // version interface
    saveCurrentVersion(sessionId: SessionId, uuid: SnapshotUUID): Promise<VCSVersion>
}

export class VCSSession {

    public readonly sessionId: SessionId
    public readonly blockId:   string
    public readonly client:    VCSClient

    public constructor(sessionId: SessionId, blockId: string, client: VCSClient) {
        this.sessionId = sessionId
        this.blockId   = blockId
        this.client    = client
    }

    public async updatePath(filePath: string): Promise<void> {
        return this.client.updatePath(this.sessionId, filePath)
    }

    public async cloneToPath(filePath: string): Promise<void> {
        return this.client.cloneToPath(this.sessionId, filePath)
    }

    public async createSnapshot(range: IRange): Promise<VCSSnapshotData | null> {
        return this.client.createSnapshot(this.sessionId, range)
    }

    public async deleteSnapshot(uuid: SnapshotUUID): Promise<void> {
        return this.client.deleteSnapshot(this.sessionId, uuid)
    }

    public async getSnapshot(uuid: SnapshotUUID): Promise<VCSSnapshotData> {
        return this.client.getSnapshot(this.sessionId, uuid)
    }  

    public async getSnapshots(): Promise<VCSSnapshotData[]> {
        return this.client.getSnapshots(this.sessionId)
    }

    public async updateSnapshot(snapshot: VCSSnapshotData): Promise<void> {
        return this.client.updateSnapshot(this.sessionId, snapshot)
    }

    public async applySnapshotVersionIndex(uuid: SnapshotUUID, versionIndex: number): Promise<Text> {
        return this.client.applySnapshotVersionIndex(this.sessionId, uuid, versionIndex)
    }

    public async lineChanged(change: LineChange): Promise<SnapshotUUID[]> {
        return this.client.lineChanged(this.sessionId, change)
    }

    public async linesChanged(change: MultiLineChange): Promise<SnapshotUUID[]> {
        return this.client.linesChanged(this.sessionId, change)
    }

    async applyChange(change: AnyChange): Promise<SnapshotUUID[]> {
        return this.client.applyChange(this.sessionId, change)
    }

    async applyChanges(changes: ChangeSet): Promise<SnapshotUUID[]> {
        return this.client.applyChanges(this.sessionId, changes)
    }

    async saveCurrentVersion(uuid: SnapshotUUID): Promise<VCSVersion> {
        return this.client.saveCurrentVersion(this.sessionId, uuid)
    }

    public async close(): Promise<void> {
        return this.client.closeSession(this.sessionId)
    }
}

export abstract class BasicVCSProvider implements VCSProvider {

    public async startSession(eol: string, options?: { filePath?: string, content?: string }): Promise<{ sessionId: SessionId, blockId: string, content: string }> {
        throw new Error("Method not implemented.")
    }

    public async closeSession(sessionId: SessionId): Promise<void> {
        throw new Error("Method not implemented.")
    }

    public async updatePath(sessionId: SessionId, filePath: string): Promise<void> {
        throw new Error("Method not implemented.")
    }

    public async cloneToPath(sessionId: SessionId, filePath: string): Promise<void> {
        throw new Error("Method not implemented.")
    }

    public async createSnapshot(sessionId: SessionId, range: IRange): Promise<VCSSnapshotData | null> {
        throw new Error("Method not implemented.")
    }

    public async deleteSnapshot(sessionId: SessionId, uuid: SnapshotUUID): Promise<void> {
        throw new Error("Method not implemented.")
    }

    public async getSnapshot(sessionId: SessionId, uuid: string): Promise<VCSSnapshotData> {
        throw new Error("Method not implemented.")
    }

    public async getSnapshots(sessionId: SessionId): Promise<VCSSnapshotData[]> {
        throw new Error("Method not implemented.")
    }

    public async updateSnapshot(sessionId: SessionId, snapshot: VCSSnapshotData): Promise<void> {
        throw new Error("Method not implemented.")
    }

    public async applySnapshotVersionIndex(sessionId: SessionId, uuid: SnapshotUUID, versionIndex: number): Promise<Text> {
        throw new Error("Method not implemented.")
    }

    public async lineChanged(sessionId: SessionId, change: LineChange): Promise<SnapshotUUID[]> {
        throw new Error("Method not implemented.")
    }

    public async linesChanged(sessionId: SessionId, change: MultiLineChange): Promise<SnapshotUUID[]> {
        throw new Error("Method not implemented.")
    }

    public async applyChange(sessionId: SessionId, change: AnyChange): Promise<SnapshotUUID[]> {
        if (change.changeBehaviour === ChangeBehaviour.Line) {
            return this.lineChanged(sessionId, change as LineChange)
        } else if (change.changeBehaviour === ChangeBehaviour.MultiLine) {
            return this.linesChanged(sessionId, change as MultiLineChange)
        } else {
            throw new Error("Change type unknown.")
        }
    }

    public async applyChanges(sessionId: SessionId, changes: ChangeSet): Promise<SnapshotUUID[]> {
        // WARNING: async forEach is completely fucked
        const uuids = []
        for (let i = 0; i < changes.length; i++) {
            uuids.push(await this.applyChange(sessionId, changes[i]))
        }
        return uuids.flat()
    }

    public async saveCurrentVersion(sessionId: SessionId, uuid: SnapshotUUID): Promise<VCSVersion> {
        throw new Error("Method not implemented.")
    }
}

// server-side interface on which end-points may be mapped
export interface VCSServer extends VCSProvider {}
export abstract class BasicVCSServer extends BasicVCSProvider implements VCSServer {}

// client-side interface which may call server end-points
export interface VCSClient extends VCSProvider {
    createSession(eol: string, options?: { filePath?: string, content?: string }): Promise<{ session: VCSSession, content: string }>
}

export abstract class BasicVCSClient extends BasicVCSProvider implements VCSClient {

    public async createSession(eol: string, options?: { filePath?: string, content?: string }): Promise<{ session: VCSSession, content: string }> {
        const result = await  this.startSession(eol, options)
        return { session: new VCSSession(result.sessionId, result.blockId, this), content: result.content }
    }
}

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

    public constructor(adapter: Adapter) {
        super()
        this.adapter = adapter
    }

    public async startSession(eol: string, options?: { filePath?: string, content?: string }): Promise<{ sessionId: SessionId, blockId: string, content: string }> {
        return this.adapter.startSession(eol, options)
    }

    public async closeSession(sessionId: SessionId): Promise<void> {
        this.adapter.closeSession(sessionId)
    }

    public async updatePath(sessionId: SessionId, filePath: string): Promise<void> {
        this.adapter.updatePath(sessionId, filePath)
    }

    public async cloneToPath(sessionId: SessionId, filePath: string): Promise<void> {
        this.adapter.cloneToPath(sessionId, filePath)
    }

    public async createSnapshot(sessionId: SessionId, range: IRange): Promise<VCSSnapshotData | null> {
        return this.adapter.createSnapshot(sessionId, range)
    }

    public async deleteSnapshot(sessionId: SessionId, uuid: SnapshotUUID): Promise<void> {
        this.adapter.deleteSnapshot(sessionId, uuid)
    }

    public async getSnapshot(sessionId: SessionId, uuid: string): Promise<VCSSnapshotData> {
        return this.adapter.getSnapshot(sessionId, uuid)
    }

    public async getSnapshots(sessionId: SessionId): Promise<VCSSnapshotData[]> {
        return this.adapter.getSnapshots(sessionId)
    }

    public async updateSnapshot(sessionId: SessionId, snapshot: VCSSnapshotData): Promise<void> {
        this.adapter.updateSnapshot(sessionId, snapshot)
    }

    public async applySnapshotVersionIndex(sessionId: SessionId, uuid: SnapshotUUID, versionIndex: number): Promise<Text> {
        return this.adapter.applySnapshotVersionIndex(sessionId, uuid, versionIndex)
    }

    public async lineChanged(sessionId: SessionId, change: LineChange): Promise<SnapshotUUID[]> {
        return this.adapter.lineChanged(sessionId, change)
    }

    public async linesChanged(sessionId: SessionId, change: MultiLineChange): Promise<SnapshotUUID[]> {
        return this.adapter.linesChanged(sessionId, change)
    }

    public async saveCurrentVersion(sessionId: SessionId, uuid: SnapshotUUID): Promise<VCSVersion> {
        return this.adapter.saveCurrentVersion(sessionId, uuid)
    }
}