import "./utils/environment"

import * as monaco from "monaco-editor"
import { Editor, Disposable, Model, URI, Selection } from "./utils/types"
import { LoadFileEvent } from "./utils/events"
import { GhostSnapshot } from "./ui/snapshot/snapshot"
import { ReferenceProvider } from "./utils/line-locator"

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

    constructor(rootElement: HTMLElement) {
        this.root = rootElement
        this.core = monaco.editor.create(rootElement, {
            value: '',
            automaticLayout: true
        });

        this.setup()
    }

    setup(): void {
        this.setup_shortcuts()

        window.ipcRenderer.on('load-file' , (response: LoadFileEvent) => {
            this.load_file(response.path, response.content)
        })

        window.ipcRenderer.on('save' , () => {
            this.save()
        })
    }

    setup_shortcuts(): void {

        const parent = this

        // https://microsoft.github.io/monaco-editor/playground.html?source=v0.37.1#example-interacting-with-the-editor-adding-an-action-to-an-editor-instance
        this.keybindings.push(this.core.addAction({
            id: "ghost-activation",
            label: "Activate Ghost",
            keybindings: [
                monaco.KeyMod.Alt | monaco.KeyCode.KeyY,
            ],
            precondition: undefined, // maybe add condition for selection
            keybindingContext: undefined,
            contextMenuGroupId: "z_ghost", // z for last spot in order
            contextMenuOrder: 1,
        
            run: function (core) {
                parent.highlight_selection()
            },
        }));
    }

    replace_text(text): void {
        this.core.setValue(text)
    }

    load_file(filePath: string, content: string): void {
        const uri = monaco.Uri.file(filePath)
        const model = monaco.editor.createModel('', undefined, uri)
        this.core.setModel(model)
        this.replace_text(content)
    }

    save(): void {
        window.ipcRenderer.invoke('save-file', { path: this.path, content: this.value })
    }

    get_selection(): Selection | null  {
        return this.core.getSelection()
    }

    highlight_selection(): void {
        const selection = this.get_selection()
        if (selection) {
            this.snapshots.push(new GhostSnapshot(this, selection))
        }
    }
}



const editorElement = document.getElementById('editor')

if (editorElement) {
    const editor = new GhostEditor(editorElement)
} else {
    console.log("FATAL ERROR: No editor element in HTML")
}