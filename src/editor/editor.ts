import "./utils/environment"

import * as monaco from "monaco-editor"
import { Editor, Disposable, Model, URI, Selection } from "./utils/types"
import { LoadFileEvent } from "./utils/events"
import { GhostSnapshot } from "./ui/snapshot/snapshot"
import { ReferenceProvider } from "./utils/line-locator"
import { ChangeBehaviour, ChangeSet, LineChange } from "../app/components/data/change"
import { VCSClient } from "../app/components/vcs/vcs-provider"
import { P5JSPreview } from "./ui/previews/ps5js-preview"
import { Preview } from "./ui/previews/preview"
import { VCSPreview } from "./ui/previews/vcs-preview"

export class GhostEditor implements ReferenceProvider {

    readonly root: HTMLElement
    readonly core: Editor

    private readonly preview: VCSPreview

    private keybindings: Disposable[] = []
    private snapshots: GhostSnapshot[] = []

    get model(): Model {
        let model = this.core.getModel()

        if (!model) {
            model = monaco.editor.createModel("")
            this.core.setModel(model)
        }

        return model
    }

    get uri(): URI {
        return this.model.uri
    }

    get path(): string | null {
        return this.uri.scheme === 'file' ? this.uri.fsPath : null
    }

    get value(): string {
        return this.core.getValue()
    }

    get modelOptions(): monaco.editor.TextModelResolvedOptions {
        return this.model.getOptions()
    }

    get topLine() : number {
        return this.core.getVisibleRanges()[0].startLineNumber
    }

    get lineHeight(): number {
        // https://github.com/microsoft/monaco-editor/issues/794
        return this.core.getOption(monaco.editor.EditorOption.lineHeight)
    }

    get fontInfo(): monaco.editor.FontInfo {
        return this.core.getOption(monaco.editor.EditorOption.fontInfo)
    }

    get characterWidth(): number {
        return this.fontInfo.typicalHalfwidthCharacterWidth
    }

    get spaceWidth(): number {
        return this.fontInfo.spaceWidth
    }

    get tabSize(): number {
        return this.modelOptions.tabSize
    }

    get eol(): string {
        const EOL = this.model.getEndOfLineSequence()
        switch(EOL) {
            case 0: return "\n"
            case 1: return "\r\n"
            default: throw new Error(`Unknown end of line sequence! Got ${EOL}`)
        }
    }

    get vcs(): VCSClient {
        return window.vcs
    }

    constructor(rootElement: HTMLElement) {
        this.root = rootElement
        this.core = monaco.editor.create(rootElement, {
            value: '',
            automaticLayout: true
        });

        const previewContainer = document.getElementById("preview")!
        //this.preview = new P5JSPreview(previewContainer)
        this.preview = new VCSPreview(previewContainer, this.model)

        this.setup()
    }

    setup(): void {
        this.setupShortcuts()
        this.setupContentEvents()

        window.ipcRenderer.on('load-file' , (response: LoadFileEvent) => {
            this.loadFile(response.path, response.content)
        })

        window.ipcRenderer.on('save' , () => {
            this.save()
        })

        this.vcs.loadFile(null, this.eol, this.value)
    }

    setupShortcuts(): void {

        const parent = this

        // https://microsoft.github.io/monaco-editor/playground.html?source=v0.37.1#example-interacting-with-the-editor-adding-an-action-to-an-editor-instance
        this.keybindings.push(this.core.addAction({
            id: "ghost-tracking",
            label: "Track with Ghost",
            keybindings: [
                monaco.KeyMod.Alt | monaco.KeyCode.KeyY,
            ],
            precondition: undefined, // maybe add condition for selection
            keybindingContext: undefined,
            contextMenuGroupId: "z_ghost", // z for last spot in order
            contextMenuOrder: 1,
        
            run: function (core) {
                parent.highlightSelection()
            },
        }));

        /*
        this.keybindings.push(this.core.addAction({
            id: "p5-preview",
            label: "P5 Preview",
            keybindings: [
                monaco.KeyMod.Alt | monaco.KeyCode.KeyP,
            ],
            precondition: undefined, // maybe add condition for selection
            keybindingContext: undefined,
            contextMenuGroupId: "z_p5_preview", // z for last spot in order
            contextMenuOrder: 2,
        
            run: function (core) {
                parent.preview.update(parent.value)
            },
        }));
        */
    }

    private cachedLineChange: LineChange | null = null
    private flushCachedChanges(): void {
        if (this.cachedLineChange) {
            this.vcs.applyChange(this.cachedLineChange)
            this.cachedLineChange = null
        }
    }

    setupContentEvents(): void {

        const contentSubscription = this.core.onDidChangeModelContent(event => {

            const changeSet = new ChangeSet(Date.now(), this.model, this.eol, event)

            /*
            // TODO: this mechanism for eliminating minimal changes and summarizing them may be optimized
            if (changeSet.length === 1 && changeSet[0].changeBehaviour === ChangeBehaviour.Line) {
                const change = changeSet[0] as LineChange
                if (!this.cachedLineChange || this.cachedLineChange?.lineNumber === change.lineNumber) {
                    this.cachedLineChange = change
                    return
                } else {
                    this.flushCachedChanges()
                }
            }
            */

            this.vcs.applyChanges(changeSet)
        })
    }

    replaceText(text: string): void {
        this.flushCachedChanges()
        this.core.setValue(text)
    }

    async loadFile(filePath: string, content: string): Promise<void> {

        this.flushCachedChanges()
        this.vcs.unloadFile()

        const uri = monaco.Uri.file(filePath)
        const model = monaco.editor.createModel(content, undefined, uri)
        this.core.setModel(model)

        this.preview.updateEditor(model)

        this.vcs.loadFile(filePath, this.eol, content)
        const snapshots = await this.vcs.getSnapshots()

        this.snapshots = snapshots.map(snapshot => {
            return new GhostSnapshot(this, snapshot)
        })
    }

    save(): void {
        this.flushCachedChanges()

        // TODO: make sure files without a path can be saved at new path!
        window.ipcRenderer.invoke('save-file', { path: this.path, content: this.value })
        if (this.path) this.vcs.updatePath(this.path)
    }

    getSelection(): Selection | null  {
        return this.core.getSelection()
    }

    async highlightSelection(): Promise<void> {
        const selection = this.getSelection()
        if (selection) {
            this.flushCachedChanges()
            const snapshot = await GhostSnapshot.create(this, selection)
            this.snapshots.push(snapshot)
        }
    }
}



const editorElement = document.getElementById('editor')

if (editorElement) {
    const editor = new GhostEditor(editorElement)
} else {
    console.log("FATAL ERROR: No editor element in HTML")
}