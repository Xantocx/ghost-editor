import { Disposable, MonacoEditor } from "../../../data-types/convenience/monaco"
import GhostSnapshot from "./snapshot"
import GhostHighlightDecoration from "../widgets/highlight-decoration"
import LineLocator from "../../../utils/line-locator"

export default class GhostSnapshotHighlight extends GhostHighlightDecoration {

    private readonly snapshot: GhostSnapshot

    private readonly layoutSubscription: Disposable

    private get core(): MonacoEditor {
        return this.snapshot.core
    }

    constructor(snapshot: GhostSnapshot, locator: LineLocator, color: string) {
        super(snapshot.core, locator, color)
        this.show()

        this.snapshot = snapshot
        this.updateWidth()

        this.addSubscription(this.onDidChange(() => this.updateWidth()))
        this.layoutSubscription = this.addSubscription(this.core.onDidLayoutChange(() => this.updateWidth()))
    }

    public override update(): void {
        super.update()
        this.updateWidth()
    }

    private updateWidth(): void {
        this.setWidth(this.snapshot.highlightWidth)
    }

    public override remove(): void {
        // has to happen asap, due to timing issues
        this.layoutSubscription.dispose()
        super.remove()
    }
}