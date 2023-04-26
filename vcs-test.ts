import { LineChange, MultiLineChange, AnyChange, ChangeSet } from "./src/app/components/data/change";
import { VCSSnapshotData, VCSSnapshot } from "./src/app/components/data/snapshot";
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
        console.log("UPDATE PATH")
    }

    cloneToPath(filePath: string): void {
        console.log("CLONE TO PATH")
    }

    async createSnapshot(range: IRange): Promise<VCSSnapshotData> {
        console.log("CREATE SNAPSHOT")
        return new VCSSnapshot(crypto.randomUUID(), this, range)
    }

    async getSnapshots(): Promise<VCSSnapshotData[]> {
        return []
    }

    updateSnapshot(snapshot: VCSSnapshotData): void {
        console.log("UPDATE SNAPSHOT")
    }

    lineChanged(change: LineChange): void {
        console.log("LINE CHANGED")
    }

    linesChanged(change: MultiLineChange): void {
        console.log("LINES CHANGED")
    }

    applyChange(change: AnyChange): void {
        console.log("APPLY CHANGE")
    }

    applyChanges(changes: ChangeSet): void {
        console.log("APPLY CHANGES")
    }

    getVersions(snapshot: VCSSnapshotData): void {
        console.log("GET VERSION")
    }
}