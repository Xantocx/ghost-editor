import { LineChange, MultiLineChange } from "../utils/change";
import { VCSSnapshot } from "../utils/snapshot";
import { VCSAdapter } from "../vcs-provider"

export class SomeAdapter implements VCSAdapter {

    get filePath(): string {
        throw new Error("Method not implemented.");
    }

    constructor(filePath: string | null, content: string | null) {
        throw new Error("Method not implemented.");
    }

    getSnapshots(): VCSSnapshot[] {
        throw new Error("Method not implemented.");
    }

    addSnapshot(snapshot: VCSSnapshot): void {
        throw new Error("Method not implemented.");
    }

    updateSnapshot(snapshot: VCSSnapshot): void {
        throw new Error("Method not implemented.");
    }

    lineChanged(change: LineChange): void {
        throw new Error("Method not implemented.");
    }

    linesChanged(change: MultiLineChange): void {
        throw new Error("Method not implemented.");
    }

    update(filePath: string): void {
        throw new Error("Method not implemented.");
    }

    dispose(): void {
        throw new Error("Method not implemented.");
    }
}