import { Editor } from "../../utils/types"
import { GhostSnapshot } from "./snapshot"
import { GhostHighlightDecoration } from "../basic/highlight-decoration"
import { LineLocator } from "../../utils/line-locator"

export class GhostSnapshotHighlight extends GhostHighlightDecoration {

    private readonly snapshot: GhostSnapshot

    private get core(): Editor {
        return this.snapshot.core
    }

    constructor(snapshot: GhostSnapshot, locator: LineLocator, color: string) {
        super(snapshot.core, locator, color)
        this.show()

        this.snapshot = snapshot
        this.updateWidth()

        const changeSubscription = this.onDidChange(event => {
            this.updateWidth()
        })

        const layoutSubscription = this.core.onDidLayoutChange(event => {
            this.updateWidth()
        })
    }

    private updateWidth(): void {
        this.setWidth(this.snapshot.highlightWidth)
    }
}