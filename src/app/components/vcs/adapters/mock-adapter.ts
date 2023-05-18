import * as crypto from "crypto"
import { Range, IRange } from "../../utils/range";
import { BasicVCSAdapter, SnapshotUUID, VersionUUID } from "../vcs-provider"
import { LineChange, MultiLineChange } from "../../data/change";
import { VCSSnapshotData, VCSSnapshot, VCSVersion } from "../../data/snapshot";

export class MockAdapter extends BasicVCSAdapter {

    private snapshots: VCSSnapshot[] = [
        new VCSSnapshot(crypto.randomUUID(), this, new Range(3, 1, 6, Number.MAX_SAFE_INTEGER), 0, 0),
        new VCSSnapshot(crypto.randomUUID(), this, new Range(9, 1, 14, Number.MAX_SAFE_INTEGER), 0, 0),
        new VCSSnapshot(crypto.randomUUID(), this, new Range(31, 1, 37, Number.MAX_SAFE_INTEGER), 0, 0),
        new VCSSnapshot(crypto.randomUUID(), this, new Range(45, 1, 40, Number.MAX_SAFE_INTEGER), 0, 0)
    ]

    private _filePath: string | null
    public get filePath(): string | null {
        return this._filePath
    }

    private set filePath(path: string) {
        this._filePath = path
    }

    constructor() {
        super()
    }

    public loadFile(filePath: string | null, eol: string, content: string | null): void {
        this.filePath = filePath
    }

    public unloadFile(): void {
        this.filePath = null
    }

    public updatePath(filePath: string): void {
        this.filePath = filePath
    }

    public cloneToPath(filePath: string): void {
        throw new Error("Method not implemented.")
    }

    async createSnapshot(range: IRange): Promise<VCSSnapshotData | null> {
        const snapshot = new VCSSnapshot(crypto.randomUUID(), this, range, 0, 0)
        console.log(snapshot)
        this.snapshots.push(snapshot)
        return snapshot
    }

    public deleteSnapshot(uuid: SnapshotUUID): void {
        throw new Error("Method not implemented.")
    }

    async getSnapshot(uuid: string): Promise<VCSSnapshotData> {
        return this.snapshots.find(snapshot => {
            return snapshot.uuid === uuid
        })
    }

    async getSnapshots(): Promise<VCSSnapshotData[]> {
        return this.snapshots
    }

    updateSnapshot(adapterSnapshot: VCSSnapshotData): void {
        const snapshot = VCSSnapshot.create(this, adapterSnapshot)

        console.log(snapshot)

        const oldSnapshot = this.snapshots.find(existingSnapshot => {
            return existingSnapshot.uuid === snapshot.uuid
        })

        if (oldSnapshot) {
            oldSnapshot.range = snapshot.range
        } else {
            throw new Error(`Snapshot with UUID ${snapshot.uuid} does not exist!`)
        }
    }

    public async applySnapshotVersionIndex(uuid: SnapshotUUID, versionIndex: number): Promise<string> {
        return ""
    }

    public async lineChanged(change: LineChange): Promise<SnapshotUUID[]> {
        // throw new Error("Method not implemented.");
        console.log(change)
        return []
    }

    public async linesChanged(change: MultiLineChange): Promise<SnapshotUUID[]> {
        // throw new Error("Method not implemented.");
        console.log(change)
        return []
    }

    public saveCurrentVersion(uuid: SnapshotUUID): Promise<VCSVersion> {
        throw new Error("Method not implemented.")
    }
}