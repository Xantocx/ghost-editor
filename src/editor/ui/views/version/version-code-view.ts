import { VCSVersion } from "../../../../app/components/data/snapshot";
import { VCSSession } from "../../../../app/components/vcs/vcs-provider";
import { Synchronizer } from "../../../utils/synchronizer";
import { GhostEditor } from "../editor/editor";
import { P5JSPreview } from "../previews/p5js-preview";
import { VersionViewContainer, VersionViewElement } from "./version-view";
import { ViewVersion } from "./version-manager";

export class VersionCodeView<Container extends VersionViewContainer<ViewVersion, VersionCodeView<Container>>> extends VersionViewElement<ViewVersion, VersionCodeView<Container>, Container> {

    public readonly languageId?: string

    private readonly listElement:      HTMLLIElement
    private readonly editorContainer:  HTMLDivElement
    private readonly editor:           GhostEditor

    private readonly editorHeight = 350

    public get style(): CSSStyleDeclaration { return this.listElement.style }

    public constructor(root: Container, version: ViewVersion, session: VCSSession, languageId?: string, synchronizer?: Synchronizer) {
        super(root, version)
        this.languageId = languageId

        this.listElement = document.createElement("li")
        this.style.boxSizing = "border-box"
        this.style.width     = "100%"
        this.style.height    = `${this.editorHeight}px`
        this.style.padding   = "5px 5px"
        this.style.margin    = "0 0"
        this.root.appendChild(this.listElement)

        this.editorContainer = document.createElement("div")
        this.editorContainer.style.width   = "100%"
        this.editorContainer.style.height  = "100%"
        this.editorContainer.style.padding = "0"
        this.editorContainer.style.margin  = "0"
        this.editorContainer.style.border  = "1px solid black"
        this.listElement.appendChild(this.editorContainer)

        this.editor = GhostEditor.createVersionEditor(this.editorContainer, version, { session, enableSideView: true, /*mainViewFlex: 3,*/ languageId: this.languageId, synchronizer })
    }

    public override remove(): void {
        this.editor.remove()
        this.listElement.remove()
        super.remove()
    }
}

export class VersionCodeViewList extends VersionViewContainer<ViewVersion, VersionCodeView<VersionCodeViewList>> {

    private          languageId?:         string
    private readonly editorSynchronizer?: Synchronizer

    public constructor(root: HTMLElement, languageId?: string, synchronizer?: Synchronizer) {

        root.style.overflow = "auto"

        const list = document.createElement("ul")
        list.style.listStyleType = "none"
        list.style.width         = "100%"
        list.style.padding       = "0 0"
        list.style.margin        = "0 0"
        root.appendChild(list)

        super(list)

        this.languageId         = languageId
        this.editorSynchronizer = synchronizer
    }

    public setLanguageId(languageId: string): void { this.languageId = languageId }

    protected override createCustomView(version: ViewVersion): VersionCodeView<VersionCodeViewList> {
        return new VersionCodeView(this as VersionCodeViewList, version, version.session, this.languageId, this.editorSynchronizer)
    }
}