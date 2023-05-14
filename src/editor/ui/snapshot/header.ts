import { GhostSnapshotBanner } from "../widgets/snapshot-banner"
import { IRange } from "../../utils/types"
import { Range } from "monaco-editor"
import { SideScrollButtonList } from "../components/side-scroll-list"

export class GhostSnapshotHeader extends GhostSnapshotBanner {

    private list: SideScrollButtonList

    protected override get lineNumber(): number {
        return this.snapshot.startLine
    }

    protected override get lineCount(): number {
        return 3
    }

    protected override contentRange(): IRange {
        const startLine = this.locator.range.startLineNumber
        return new Range(startLine - this.lineCount, 1, startLine - 1, Number.MAX_SAFE_INTEGER)
    }

    protected override setupContent(container: HTMLElement): void {
        this.list = new SideScrollButtonList(container, ["Item 1", "Item 2", "Item 3", "Item 4", "Item 5", "Item 6", "Item 7", "Item 8", "Item 9", "Item 10", "Item 11"])
    }
}