import { VCSVersion } from "../../../../app/components/data/snapshot";
import { Synchronizer } from "../../../utils/synchronizer";
import { GhostEditor } from "../editor/editor";
import { View } from "../view";

export class VersionCodeView extends View {

    public  readonly version: VCSVersion
    private readonly editor:  GhostEditor

    public constructor(root: HTMLElement, version: VCSVersion, synchronizer?: Synchronizer) {
        super(root)
        this.version = version
        this.editor  = GhostEditor.createVersionEditor(this.root, version, synchronizer)
    }
}

export class VersionCodeViewList extends View {

    private readonly list: HTMLUListElement

    public get style(): CSSStyleDeclaration {
        return this.list.style
    }

    public constructor(root: HTMLElement) {
        super(root)

        this.list = document.createElement("ul")
        this.style.width = "100%"
        this.style.listStyleType = "none"
        this.style.overflowY = "auto"
        this.root.appendChild(this.list)
    }
}