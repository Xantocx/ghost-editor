import * as crypto from "crypto"
import { BasicVCSAdapter } from "../vcs-provider"
import { LineChange, MultiLineChange } from "../../data/change";
import { IRange, Range, VCSSnapshotData, VCSSnapshot } from "../../data/snapshot";

export class MockAdapter extends BasicVCSAdapter {

    private snapshots: VCSSnapshot[] = [
        new VCSSnapshot(crypto.randomUUID(), this, new Range(3, 1, 6, Number.MAX_SAFE_INTEGER)),
        new VCSSnapshot(crypto.randomUUID(), this, new Range(9, 1, 14, Number.MAX_SAFE_INTEGER)),
        new VCSSnapshot(crypto.randomUUID(), this, new Range(31, 1, 37, Number.MAX_SAFE_INTEGER)),
        new VCSSnapshot(crypto.randomUUID(), this, new Range(45, 1, 40, Number.MAX_SAFE_INTEGER))
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

    public loadFile(filePath: string | null, content: string | null): void {
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

    async createSnapshot(range: IRange): Promise<VCSSnapshotData> {
        const snapshot = new VCSSnapshot(crypto.randomUUID(), this, range)
        console.log(snapshot)
        this.snapshots.push(snapshot)
        return snapshot
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
            oldSnapshot.update(snapshot.range)
        } else {
            throw new Error(`Snapshot with UUID ${snapshot.uuid} does not exist!`)
        }
    }

    lineChanged(change: LineChange): void {
        // throw new Error("Method not implemented.");
        console.log(change)
    }

    linesChanged(change: MultiLineChange): void {
        // throw new Error("Method not implemented.");
        console.log(change)
    }

    public getVersions(snapshot: VCSSnapshotData): void {
        throw new Error("Method not implemented.")
    }
}