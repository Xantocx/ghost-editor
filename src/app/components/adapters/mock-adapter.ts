import { LineChange, MultiLineChange } from "../utils/change";
import { IRange, Range, VCSAdapterSnapshot, VCSSnapshot } from "../utils/snapshot";
import { VCSAdapter } from "../vcs-provider"
import * as crypto from "crypto"

export class MockAdapter implements VCSAdapter {

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

    constructor(filePath: string | null, content: string | null) {
        this.filePath = filePath
    }

    async createSnapshot(range: IRange): Promise<VCSAdapterSnapshot> {
        const snapshot = new VCSSnapshot(crypto.randomUUID(), this, range)
        console.log(snapshot)
        this.snapshots.push(snapshot)
        return snapshot
    }

    async getSnapshots(): Promise<VCSAdapterSnapshot[]> {
        return this.snapshots
    }

    updateSnapshot(adapterSnapshot: VCSAdapterSnapshot): void {
        const snapshot = VCSSnapshot.recover(this, adapterSnapshot)

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

    update(filePath: string): void {
        // throw new Error("Method not implemented.");
        console.log("New File Path: " + filePath)
    }

    dispose(): void {
        // throw new Error("Method not implemented.");
        console.log("Disposed.")
    }
}