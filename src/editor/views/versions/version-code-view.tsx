import VCSVersion from "../../data-types/version";
import { VCSBlockId, VCSBlockSession } from "../../../vcs/provider";
import Synchronizer from "../../utils/synchronizer";
import { IconButton, IconButtonProps, TextButton, TextButtonProps } from "../basics/react-button";
import GhostSnapshot from "../monaco/snapshot/snapshot";
import GhostEditor, { GhostBlockSessionLoadingOptions } from "../../index";
import LoadingView, { LoadingEventEmitter } from "../react/loadingView";
import { VersionViewContainer, VersionViewElement } from "./version-view";

import React from "react";
import { createRoot } from "react-dom/client";

export class VersionCodeView<Container extends VersionViewContainer<VCSVersion, VersionCodeView<Container>>> extends VersionViewElement<VCSVersion, VersionCodeView<Container>, Container> {

    public readonly session: VCSBlockSession

    private readonly listElement:      HTMLLIElement
    private readonly menuContainer:    HTMLDivElement
    private readonly editorContainer:  HTMLDivElement
    private readonly editor:           GhostEditor

    private readonly editorHeight = 350
    private readonly menuSpacing  = 40

    public get style(): CSSStyleDeclaration { return this.listElement.style }

    public get blockId(): VCSBlockId { return this.session.block }

    public constructor(root: Container, version: VCSVersion, versionSession: VCSBlockSession, languageId?: string, synchronizer?: Synchronizer) {
        super(root, version)
        this.session = versionSession

        this.listElement = document.createElement("li")
        this.style.boxSizing = "border-box"
        this.style.width     = "100%"
        this.style.height    = `${this.editorHeight}px`
        this.style.padding   = "5px 5px"
        this.style.margin    = "0 0"
        this.root.appendChild(this.listElement)
        
        this.menuContainer   = document.createElement("div")
        this.editorContainer = document.createElement("div")

        this.setupMenu(version.snapshot)
        this.setupEditor()

        this.editor = GhostEditor.createEditorFromSession(this.editorContainer, new GhostBlockSessionLoadingOptions(versionSession), { enableSideView: true, hideErrorMessage: true, mainViewFlex: 3, languageId, synchronizer })
    }

    private setupMenu(snapshot: GhostSnapshot): void {

        const createSeperator = () => {
            const seperator = document.createElement("div")
            seperator.style.display        = "flex"
            seperator.style.justifyContent = "center"
            seperator.style.width          = "100%"
            seperator.style.padding        = "0"
            seperator.style.margin         = "0"
            seperator.style.borderBottom   = "1px solid black"
            this.menuContainer.appendChild(seperator)

            return seperator
        }

        this.menuContainer.style.boxSizing   = "border-box"
        this.menuContainer.style.float       = "left"
        this.menuContainer.style.width       = `${this.menuSpacing}px`
        this.menuContainer.style.height      = "100%"
        this.menuContainer.style.padding     = "0"
        this.menuContainer.style.margin      = "0"
        this.menuContainer.style.border      = "1px solid black"
        this.menuContainer.style.borderRight = "none"
        this.listElement.appendChild(this.menuContainer)

        const loadingEventEmitter              = new LoadingEventEmitter()
        let   loadingPromise: Promise<unknown> = Promise.resolve()

        async function withLoadingAnimation(execute: () => Promise<void>): Promise<void> {
            let resolvePromise: () => void = () => { throw new Error("Promise was not initialized as expected!") }
            loadingPromise = new Promise<void>((resolve) => { resolvePromise = resolve })
            loadingEventEmitter.reload()
            await execute()
            resolvePromise()
        }

        const copyToOriginButtonRoot       = createRoot(createSeperator())
        const duplicateButtonRoot          = createRoot(createSeperator())

        copyToOriginButtonRoot.render(<LoadingView ContentView={IconButton} loadingEventEmitter={loadingEventEmitter} loadData={async () => {
            await loadingPromise

            const props: IconButtonProps = {
                icon: "fas fa-arrow-right-to-bracket",
                style: {
                    backgroundColor: "orange",
                    color:           "white",
                    transform:       "scaleX(-1)",
                    padding:         "5px 7.09px",
                    margin:          "5px"
                },
                onClick: async () => {
                    withLoadingAnimation(async () => {
                        await snapshot.session.syncBlocks(this.blockId, snapshot.vcsId)
                        await snapshot.editor.syncWithVCS()
                        await snapshot.editor.setActiveSnapshot(undefined)
                    })
                },
            }

            return props
        }}/>)
        
        duplicateButtonRoot.render(<LoadingView ContentView={TextButton} loadingEventEmitter={loadingEventEmitter} loadData={async () => {
            await loadingPromise

            const props: TextButtonProps = {
                text: "+",
                style: {
                    backgroundColor: "green",
                    color:           "white",
                    padding:         "5px 10px",
                    margin:          "5px"
                },
                onClick: async () => {
                    withLoadingAnimation(async () => {
                        const codeForAi = await this.session.getText()
                        const version   = await snapshot.createVersion({ codeForAi })
                        const session   = await version.getSession()
                        session.syncWithBlock(this.blockId)
                        this.editor.triggerSync()
                    })
                },
            }

            return props
        }}/>)
    }

    private setupEditor(): void {
        this.editorContainer.style.boxSizing = "border-box"
        this.editorContainer.style.float     = "left"
        this.editorContainer.style.width     = `calc(100% - ${this.menuSpacing}px)`
        this.editorContainer.style.height    = "100%"
        this.editorContainer.style.padding   = "0"
        this.editorContainer.style.margin    = "0"
        this.editorContainer.style.border    = "1px solid black"
        this.listElement.appendChild(this.editorContainer)
    }

    public override remove(): void {
        this.editor.remove()
        this.listElement.remove()
        super.remove()
    }
}

export default class VersionCodeViewList extends VersionViewContainer<VCSVersion, VersionCodeView<VersionCodeViewList>> {

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

    protected override async createCustomView(version: VCSVersion): Promise<VersionCodeView<VersionCodeViewList>> {
        const session = await version.getSession()
        return new VersionCodeView(this as VersionCodeViewList, version, session, this.languageId, this.editorSynchronizer)
    }
}