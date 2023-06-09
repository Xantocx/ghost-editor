import { VCSTag } from "../../../../app/components/data/snapshot"
import { Synchronizer } from "../../../utils/synchronizer"
import { Button, P5JSPreviewToggleButton } from "../../components/button"
import { VCSVersion } from "../../snapshot/snapshot"
import { VersionViewContainer } from "./version-view"

export class VersionGridView extends VersionViewContainer<VCSVersion, P5JSPreviewToggleButton<VCSVersion, VersionGridView>> {

    private readonly onClick: (version: VCSVersion, selected: boolean) => void
    private readonly previewSynchronizer?: Synchronizer

    private readonly minWidth  = 200
    private readonly minHeight = 100
    
    private readonly maxHeight = 150

    public constructor(root: HTMLElement, onClick: (version: VCSVersion, select: boolean) => void, synchronizer?: Synchronizer) {
        super(root)
        this.onClick             = onClick
        this.previewSynchronizer = synchronizer

        this.style.display             = "grid"
        this.style.alignItems          = "center"
        this.style.gridTemplateColumns = `repeat(auto-fill, minmax(${this.minWidth}px, 1fr))`
        this.style.gridAutoRows        = `minmax(${this.minHeight}px, ${this.maxHeight}px)`
        this.style.gap                 = "10px"
        this.style.overflow            = "auto"
    }

    protected override async createCustomView(version: VCSVersion): Promise<P5JSPreviewToggleButton<VCSVersion, VersionGridView>> {
        const session = await version.getSession()
        const preview = Button.p5jsPreviewToggleButton(this as VersionGridView, version, session, (version, selected) => this.onClick(version, selected), this.previewSynchronizer)
        preview.style.width  = "100%"
        preview.style.height = "100%"
        return preview
    }
}