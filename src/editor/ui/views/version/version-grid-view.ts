import { VCSVersion } from "../../../../app/components/data/snapshot"
import { Button, P5JSPreviewToggleButton } from "../../components/button"
import { VersionViewContainer } from "./version-view"

export class VersionGridView extends VersionViewContainer<P5JSPreviewToggleButton<VersionGridView>> {

    private readonly onClick: (version: VCSVersion, selected: boolean) => void

    private readonly minWidth  = 200
    private readonly minHeight = 100

    public constructor(root: HTMLElement, onClick: (version: VCSVersion, select: boolean) => void) {
        super(root)
        this.onClick = onClick

        this.style.display             = "grid"
        this.style.gridTemplateColumns = `repeat(auto-fill, minmax(${this.minWidth}px, 1fr))`
        this.style.gridAutoRows        = `minmax(${this.minHeight}px, auto)`
        this.style.gap                 = "10px"
        this.style.overflow            = "auto"
    }

    protected override createCustomView(version: VCSVersion): P5JSPreviewToggleButton<VersionGridView> {
        return Button.p5jsPreviewToggleButton(this as VersionGridView, version, { padding: 5 }, (version, selected) => this.onClick(version, selected))
    }
}