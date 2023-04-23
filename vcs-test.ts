import { LineChange, MultiLineChange, AnyChange, ChangeSet } from "./src/app/components/data/change";
import { VCSSnapshotData } from "./src/app/components/data/snapshot";
import { IRange } from "./src/app/components/utils/range";
import { VCSServer } from "./src/app/components/vcs/vcs-provider";

export class GhostVCSServer {

    loadFile(filePath: string | null, content: string | null): void {
        console.log("LOAD: " + filePath)
    }

    unloadFile(): void {
        console.log("UNLOADED")
    }

    updatePath(filePath: string): void {
        throw new Error("Method not implemented.");
    }

    cloneToPath(filePath: string): void {
        throw new Error("Method not implemented.");
    }

    async createSnapshot(range: IRange): Promise<VCSSnapshotData> {
        throw new Error("Method not implemented.");
    }

    async getSnapshots(): Promise<VCSSnapshotData[]> {
        return []
    }

    updateSnapshot(snapshot: VCSSnapshotData): void {
        throw new Error("Method not implemented.");
    }

    lineChanged(change: LineChange): void {
        throw new Error("Method not implemented.");
    }

    linesChanged(change: MultiLineChange): void {
        throw new Error("Method not implemented.");
    }

    applyChange(change: AnyChange): void {
        throw new Error("Method not implemented.");
    }

    applyChanges(changes: ChangeSet): void {
        throw new Error("Method not implemented.");
    }

    getVersions(snapshot: VCSSnapshotData): void {
        throw new Error("Method not implemented.");
    }
}