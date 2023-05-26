import { VCSVersion } from "../../../../app/components/data/snapshot";
import { Synchronizer } from "../../../utils/synchronizer";
import { GhostEditor } from "../editor/editor";
import { VersionViewContainer, VersionViewElement } from "./version-view";

export class VersionCodeView<Container extends VersionViewContainer<VersionCodeView<Container>>> extends VersionViewElement<VersionCodeView<Container>, Container> {

    private readonly listElement: HTMLLIElement
    private readonly editor:      GhostEditor

    public get style(): CSSStyleDeclaration { return this.listElement.style }

    public constructor(root: Container, version: VCSVersion, synchronizer?: Synchronizer) {
        super(root, version)

        this.listElement = document.createElement("li")
        this.style.boxSizing = "border-box"
        this.style.width     = "100%"
        this.style.maxHeight = "500px"
        this.style.padding   = "0 0"
        this.style.margin    = "0 0"
        //this.style.border    = "1px solid black"
        //this.style.overflow = "hidden"
        this.root.appendChild(this.listElement)

        this.editor = GhostEditor.createVersionEditor(this.listElement, version, synchronizer)

        this.style.minHeight = `${this.editor.lineHeight + 10}px`
    }

    public override remove(): void {
        this.listElement.remove()
        super.remove()
    }
}

export class VersionCodeViewList extends VersionViewContainer<VersionCodeView<VersionCodeViewList>> {

    private readonly editorSynchronizer?: Synchronizer

    public constructor(root: HTMLElement, synchronizer?: Synchronizer) {

        const list = document.createElement("ul")

        list.style.boxSizing     = "border-box"
        list.style.listStyleType = "none"
        list.style.width         = "100%"
        list.style.height        = "100%"
        list.style.padding       = "0 0"
        list.style.margin        = "0 0"

        root.appendChild(list)

        super(list)
        this.editorSynchronizer = synchronizer
    }

    protected override createCustomView(version: VCSVersion): VersionCodeView<VersionCodeViewList> {
        return new VersionCodeView(this as VersionCodeViewList, version, this.editorSynchronizer)
    }
}