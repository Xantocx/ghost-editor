import { LineChange, MultiLineChange } from "../utils/change";
import { IRange, Range, VCSSnapshot } from "../utils/snapshot";
import { VCSAdapter } from "../vcs-provider"

export class MockAdapter implements VCSAdapter {

    private snapshots: VCSSnapshot[] = [
        new VCSSnapshot(this, new Range(3, 1, 6, Number.MAX_SAFE_INTEGER)),
        new VCSSnapshot(this, new Range(9, 1, 14, Number.MAX_SAFE_INTEGER)),
        new VCSSnapshot(this, new Range(31, 1, 37, Number.MAX_SAFE_INTEGER)),
        new VCSSnapshot(this, new Range(45, 1, 40, Number.MAX_SAFE_INTEGER))
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

    createSnapshot(range: IRange): VCSSnapshot {
        const snapshot = new VCSSnapshot(this, range)
        this.snapshots.push(snapshot)
        return snapshot
    }

    getSnapshots(): VCSSnapshot[] {
        return this.snapshots
    }

    updateSnapshot(snapshot: VCSSnapshot): void {
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