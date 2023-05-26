import { VCSVersion } from "../../../../app/components/data/snapshot";
import { Synchronizer } from "../../../utils/synchronizer";
import { GhostEditor } from "../editor/editor";
import { VersionViewContainer, VersionViewElement } from "./version-view";

export class VersionCodeView<Container extends VersionViewContainer<VersionCodeView<Container>>> extends VersionViewElement<VersionCodeView<Container>, Container> {

    private readonly listElement:     HTMLLIElement
    private readonly editorContainer: HTMLDivElement
    private readonly editor:          GhostEditor

    public get style(): CSSStyleDeclaration { return this.listElement.style }

    public constructor(root: Container, version: VCSVersion, synchronizer?: Synchronizer) {
        super(root, version)

        this.listElement = document.createElement("li")
        this.style.boxSizing = "border-box"
        this.style.width     = "calc(100% - 20px)"
        this.style.height    = "calc(500px - 20px)"
        this.style.padding   = "0 0"
        this.style.margin    = "10px 10px"
        this.style.border    = "1px solid black"
        this.root.appendChild(this.listElement)

        this.editorContainer = document.createElement("div")
        this.editorContainer.style.width     = "100%"
        this.editorContainer.style.height    = "100%"
        this.editorContainer.style.padding   = "0 0"
        this.editorContainer.style.margin    = "0 0"
        this.listElement.appendChild(this.editorContainer)

        this.editor = GhostEditor.createVersionEditor(this.editorContainer, version, synchronizer)

        //this.editorContainer.style.minHeight = `${this.editor.lineHeight + 10}px`
    }

    public override remove(): void {
        this.listElement.remove()
        super.remove()
    }
}

export class VersionCodeViewList extends VersionViewContainer<VersionCodeView<VersionCodeViewList>> {

    private readonly listContainer:       HTMLDivElement
    private readonly editorSynchronizer?: Synchronizer

    public constructor(root: HTMLElement, synchronizer?: Synchronizer) {

        /*
        const listContainer = document.createElement("div")
        listContainer.style.width     = "100%"
        listContainer.style.height    = "100%"
        listContainer.style.padding   = "0 0"
        listContainer.style.margin    = "0 0"
        root.appendChild(listContainer)
        */

        const list = document.createElement("ul")
        list.style.listStyleType = "none"
        list.style.width         = "100%"
        list.style.height        = "100%"
        list.style.padding       = "0 0"
        list.style.margin        = "0 0"
        root.appendChild(list)

        super(list)

        //this.listContainer      = listContainer
        this.editorSynchronizer = synchronizer
    }

    protected override createCustomView(version: VCSVersion): VersionCodeView<VersionCodeViewList> {
        return new VersionCodeView(this as VersionCodeViewList, version, this.editorSynchronizer)
    }

    public override remove(): void {
        //this.listContainer.remove()
        super.remove()
    }
}