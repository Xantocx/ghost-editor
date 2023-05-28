import { VCSVersion } from "../../../../app/components/data/snapshot"
import { Button, P5JSPreviewToggleButton } from "../../components/button"
import { VersionViewContainer } from "./version-view"

export class VersionGridView extends VersionViewContainer<P5JSPreviewToggleButton<VersionGridView>> {

    private readonly onClick: (version: VCSVersion, selected: boolean) => void

    private readonly minWidth  = 200
    private readonly minHeight = 100
    
    private readonly maxHeight = 150

    public constructor(root: HTMLElement, onClick: (version: VCSVersion, select: boolean) => void) {
        super(root)
        this.onClick = onClick

        this.style.display             = "grid"
        this.style.alignItems          = "center"
        this.style.gridTemplateColumns = `repeat(auto-fill, minmax(${this.minWidth}px, 1fr))`
        this.style.gridAutoRows        = `minmax(${this.minHeight}px, ${this.maxHeight}px)`
        this.style.gap                 = "10px"
        this.style.overflow            = "auto"
    }

    protected override createCustomView(version: VCSVersion): P5JSPreviewToggleButton<VersionGridView> {
        const preview = Button.p5jsPreviewToggleButton(this as VersionGridView, version, (version, selected) => this.onClick(version, selected))
        preview.style.width  = "100%"
        preview.style.height = "100%"
        return preview
    }
}