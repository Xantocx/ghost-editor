import { GhostSnapshotBanner } from "../widgets/snapshot-banner"
import { IRange } from "../../utils/types"
import { Range } from "monaco-editor"

export class GhostSnapshotHeader extends GhostSnapshotBanner {

    protected override get lineNumber(): number {
        return this.snapshot.startLine
    }

    protected override get lineCount(): number {
        return 2
    }

    protected override contentRange(): IRange {
        const startLine = this.locator.range.startLineNumber
        return new Range(startLine - this.lineCount, 1, startLine - 1, Number.MAX_SAFE_INTEGER)
    }
}