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

    private readonly preview: P5JSPreview

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
        this.preview = new P5JSPreview(previewContainer)
        //this.preview = new VCSPreview(previewContainer, this.model)

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

        this.keybindings.push(this.core.addAction({
            id: "p5-preview",
            label: "P5 Preview",
            keybindings: [
                monaco.KeyMod.Alt | monaco.KeyCode.KeyP,
            ],
            precondition: undefined, // maybe add condition for selection
            keybindingContext: undefined,
            contextMenuGroupId: "y_p5_preview", // z for last spot in order
            contextMenuOrder: 1,
        
            run: function (core) {
                parent.preview.update(parent.value)
            },
        }))

        // https://microsoft.github.io/monaco-editor/playground.html?source=v0.37.1#example-interacting-with-the-editor-adding-an-action-to-an-editor-instance
        this.keybindings.push(this.core.addAction({
            id: "ghost-tracking",
            label: "Add/Remove Snapshot",
            keybindings: [
                monaco.KeyMod.Alt | monaco.KeyCode.KeyY,
            ],
            precondition: "editorHasSelection", // maybe add condition for selection
            keybindingContext: "editorTextFocus",
            contextMenuGroupId: "z_ghost", // z for last spot in order
            contextMenuOrder: 1,
        
            run: function (core) {
                parent.highlightSelection()
            },
        }));


        /*
        const hasSnapshotSelectionKey = this.core.createContextKey<boolean>('hasSnapshotSelection', false);
        this.core.onDidChangeCursorPosition((event) => {
            const snapshots = this.getSnapshots(event.position.lineNumber)
            hasSnapshotSelectionKey.set(snapshots.length > 0);
        });

        this.keybindings.push(this.core.addAction({
            id: "ghost-menu",
            label: "Show Ghost Menu",
            keybindings: [
                monaco.KeyMod.Alt | monaco.KeyCode.KeyX,
            ],
            precondition: 'hasSnapshotSelection', // maybe add condition for selection
            keybindingContext: undefined,
            contextMenuGroupId: "z_ghost", // z for last spot in order
            contextMenuOrder: 2,
        
            run: function (core) {
                const lineNumber = parent.core.getPosition()?.lineNumber
                const snapshots: GhostSnapshot[] = lineNumber ? parent.getSnapshots(lineNumber) : []
                snapshots.forEach(snapshot => snapshot.toggleMenu())
            },
        }));
        */
    }

    private manualContentChange = false
    setupContentEvents(): void {

        const contentSubscription = this.core.onDidChangeModelContent(async event => {

            if (!this.manualContentChange) {
                const changeSet = new ChangeSet(Date.now(), this.model, this.eol, event)

                // forEach is a bitch for anything but synchronous arrays...
                const changedSnapshots = new Set(await this.vcs.applyChanges(changeSet))
                changedSnapshots.forEach(uuid => {
                    this.getSnapshot(uuid)?.update()
                })
            }
        })

        const curserSubscription = this.core.onDidChangeCursorPosition(async event => {
            const lineNumber = this.core.getPosition()?.lineNumber
            this.snapshots.forEach(snapshot => {
                if (lineNumber && snapshot.containsLine(lineNumber)) {
                    snapshot.showMenu()
                } else {
                    snapshot.hideMenu()
                }
            })
        })
    }

    update(text: string): void {
        this.manualContentChange = true
        this.core.setValue(text)
        this.manualContentChange = false

        this.snapshots.forEach(snapshot => {
            snapshot.manualUpdate()
        })
    }

    unloadFile(): void {
        this.removeSnapshots()
        this.vcs.unloadFile()
    }

    async loadFile(filePath: string, content: string): Promise<void> {

        this.unloadFile()

        const uri = monaco.Uri.file(filePath)

        let model = monaco.editor.getModel(uri)
        if (model) {
            model.setValue(content)
        } else {
            model = monaco.editor.createModel(content, undefined, uri)
        }

        this.core.setModel(model)

        //this.preview.updateEditor(model)

        this.vcs.loadFile(filePath, this.eol, content)
        const snapshots = await this.vcs.getSnapshots()

        this.snapshots = snapshots.map(snapshot => {
            return new GhostSnapshot(this, snapshot)
        })
    }

    save(): void {
        // TODO: make sure files without a path can be saved at new path!
        window.ipcRenderer.invoke('save-file', { path: this.path, content: this.value })
        if (this.path) this.vcs.updatePath(this.path)
    }

    getSelection(): Selection | null  {
        return this.core.getSelection()
    }

    getSnapshot(uuid: string): GhostSnapshot | undefined {
        return this.snapshots.find(snapshot => { return snapshot.uuid === uuid })
    }

    getSnapshots(lineNumber: number): GhostSnapshot[] {
        return this.snapshots.filter(snapshot => { return snapshot.startLine <= lineNumber && snapshot.endLine >= lineNumber })
    }

    removeSnapshots(): void {
        this.snapshots.forEach(snapshot => snapshot.remove())
    }

    async highlightSelection(): Promise<void> {

        const selection = this.getSelection()

        if (selection) {

            const overlappingSnapshot = this.snapshots.find(snapshot => {
                return snapshot.startLine <= selection.endLineNumber && snapshot.endLine >= selection.startLineNumber
            })

            if (!overlappingSnapshot){
                const snapshot = await GhostSnapshot.create(this, selection)
                if (snapshot) { this.snapshots.push(snapshot) }
            } else {
                console.warn(`You cannot create a snapshot overlapping with ${overlappingSnapshot.snapshot.uuid}}!`)
            }

        }
    }
}



const editorElement = document.getElementById('editor')

if (editorElement) {
    const editor = new GhostEditor(editorElement)
} else {
    console.error("FATAL ERROR: No editor element in HTML")
}