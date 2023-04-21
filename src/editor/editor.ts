import "./utils/environment"

import * as monaco from "monaco-editor"
import { Editor, Disposable, Model, URI, Selection } from "./utils/types"
import { LoadFileEvent } from "./utils/events"
import { GhostSnapshot } from "./ui/snapshot/snapshot"
import { ReferenceProvider } from "./utils/line-locator"
import { ChangeSet } from "../app/components/utils/change"

export class GhostEditor implements ReferenceProvider {

    readonly root: HTMLElement
    readonly core: Editor

    private keybindings: Disposable[] = []
    private snapshots: GhostSnapshot[] = []

    get model(): Model | null {
        return this.core.getModel()
    }

    get uri(): URI | null {
        return this.model ? this.model.uri : null
    }

    get path(): string | null {
        return this.uri && this.uri.scheme === 'file' ? this.uri.fsPath : null
    }

    get value(): string {
        return this.core.getValue()
    }

    get modelOptions(): monaco.editor.TextModelResolvedOptions | undefined {
        return this.model?.getOptions()
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

    get tabSize(): number | undefined {
        return this.modelOptions?.tabSize
    }

    get vcs(): typeof window.vcs {
        return window.vcs
    }

    constructor(rootElement: HTMLElement) {
        this.root = rootElement
        this.core = monaco.editor.create(rootElement, {
            value: '',
            automaticLayout: true
        });

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
    }

    setupContentEvents(): void {
        const contentSubscription = this.core.onDidChangeModelContent(event => {
            const changeSet = new ChangeSet(Date.now(), event)
            this.vcs.applyChanges(changeSet)
        })
    }

    replaceText(text: string): void {
        this.core.setValue(text)
    }

    loadFile(filePath: string, content: string): void {

        this.vcs.dispose()

        const uri = monaco.Uri.file(filePath)
        const model = monaco.editor.createModel('', undefined, uri)
        this.core.setModel(model)
        this.replaceText(content)

        this.vcs.createAdapter(filePath, content)
        const snapshots = this.vcs.getSnapshots()

        this.snapshots = snapshots.map(snapshot => {
            return new GhostSnapshot(this, snapshot)
        })
    }

    save(): void {
        // TODO: make sure files without a path can be saved at new path!
        window.ipcRenderer.invoke('save-file', { path: this.path, content: this.value })
        if (this.path) this.vcs.update(this.path)
    }

    getSelection(): Selection | null  {
        return this.core.getSelection()
    }

    highlightSelection(): void {
        const selection = this.getSelection()
        if (selection) {
            const snapshot = GhostSnapshot.create(this, selection)
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