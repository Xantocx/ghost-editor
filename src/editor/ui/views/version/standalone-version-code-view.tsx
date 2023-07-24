import { VCSVersion } from "../../../../app/components/data/version";
import { VCSBlockId, VCSBlockSession } from "../../../../app/components/vcs/vcs-rework";
import { Synchronizer } from "../../../utils/synchronizer";
import { IconButton, IconButtonProps, TextButton, TextButtonProps } from "../../components/react-button";
import { GhostSnapshot } from "../../snapshot/snapshot";
import { GhostBlockSessionLoadingOptions, GhostEditor } from "../editor/editor";
import LoadingView, { LoadingEventEmitter } from "../utils/loadingView";
import { View } from "../view";

import React from "react";
import { createRoot } from "react-dom/client";

export class VersionCodeView extends View {

    public readonly version: VCSVersion
    public readonly session: VCSBlockSession

    private readonly container: HTMLDivElement

    private readonly menuContainer:    HTMLDivElement
    private readonly editorContainer:  HTMLDivElement
    private readonly editor:           GhostEditor

    private readonly menuSpacing  = 40

    public get style(): CSSStyleDeclaration { return this.container.style }

    public get blockId(): VCSBlockId { return this.session.block }

    public static async create(root: HTMLElement, version: VCSVersion, languageId?: string, synchronizer?: Synchronizer): Promise<VersionCodeView> {
        const session = await version.getSession()
        return new VersionCodeView(root, version, session, languageId, synchronizer)
    }

    public constructor(root: HTMLElement, version: VCSVersion, versionSession: VCSBlockSession, languageId?: string, synchronizer?: Synchronizer) {
        super(root)
        this.version = version
        this.session = versionSession

        this.container = document.createElement("div")
        this.style.boxSizing = "border-box"
        this.style.width     = "100%"
        this.style.height    = "100%"
        this.style.padding   = "0"
        this.style.margin    = "0"
        this.root.appendChild(this.container)
        
        this.menuContainer   = document.createElement("div")
        this.editorContainer = document.createElement("div")

        this.setupMenu(version.snapshot)
        this.setupEditor()

        this.editor = GhostEditor.createEditorFromSession(this.editorContainer, new GhostBlockSessionLoadingOptions(versionSession), { enableSideView: true, hideErrorMessage: true, mainViewFlex: 3, languageId, synchronizer })
    }

    private setupMenu(snapshot: GhostSnapshot): void {

        const parent = this
        function createSeperator(): HTMLDivElement {
            const seperator = document.createElement("div")
            seperator.style.display        = "flex"
            seperator.style.justifyContent = "center"
            seperator.style.width          = "100%"
            seperator.style.padding        = "0"
            seperator.style.margin         = "0"
            seperator.style.borderBottom   = "1px solid black"
            parent.menuContainer.appendChild(seperator)

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
        this.container.appendChild(this.menuContainer)

        const loadingEventEmitter          = new LoadingEventEmitter()
        let   loadingPromise: Promise<any> = Promise.resolve()

        async function withLoadingAnimation(execute: () => Promise<void>): Promise<void> {
            let resolvePromise: () => void = () => { throw new Error("Promise was not initialized as expected!") }
            loadingPromise = new Promise<void>((resolve, reject) => { resolvePromise = resolve })
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
        this.container.appendChild(this.editorContainer)
    }

    public override remove(): void {
        this.editor.remove()
        this.container.remove()
        super.remove()
    }
}