import * as monaco from "monaco-editor"
import Preview from "./preview";
import { MonacoModel } from "../../data-types/convenience/monaco";
import { GhostEditorModel } from "../../index";

export default class VCSPreview extends Preview {

    private editorModel?:  GhostEditorModel

    private readonly diffEditor:  monaco.editor.IStandaloneDiffEditor
    private readonly decorations: monaco.editor.IEditorDecorationsCollection

    private readonly vcsTextModel:     MonacoModel = monaco.editor.createModel("")
    private readonly defaultTextModel: MonacoModel = monaco.editor.createModel("")

    public get blockId(): string | undefined { return this.editorModel?.session?.blockId }

    constructor(root: HTMLElement, editorModel?: GhostEditorModel) {
        super(root)

        this.diffEditor = monaco.editor.createDiffEditor(this.root, {
            enableSplitViewResizing: true,
            automaticLayout: true,
            originalEditable: false,
        });

        this.decorations = this.diffEditor.createDecorationsCollection()

        // TODO: fix id selector
        window.ipcRenderer.on("update-vcs-preview", (blockId: string, content: string, versionCounts: number[]) => {
            /*if (this.blockId === blockId) { */this.updateVCS(content, versionCounts)// }
        })

        this.updateEditor(editorModel)
    }

    private getEditorTextModel(): MonacoModel | undefined { return this.editorModel?.textModel }

    public updateEditor(editorModel?: GhostEditorModel, vcsContent?: string): void {

        this.editorModel = editorModel

        if (editorModel) {
            const editorTextModel = this.getEditorTextModel()
            monaco.editor.setModelLanguage(this.vcsTextModel, editorTextModel.getLanguageId())

            this.diffEditor.setModel({ 
                original: editorTextModel,
                modified: this.vcsTextModel
            })

            this.updateVCS(vcsContent ? vcsContent : "")
        } else {
            this.diffEditor.setModel({ 
                original: this.defaultTextModel,
                modified: this.defaultTextModel
            })
        }
    }

    public updateVCS(content: string, versionCounts?: number[]): void {
        this.vcsTextModel.setValue(content)
        
        function createDecoration(lineNumber: number, versionCount?: number): monaco.editor.IModelDeltaDecoration {
            let versionCountText = `${versionCount ? versionCount : "?"} versions:\t`
            while (versionCountText.length < 14) { versionCountText = " " + versionCountText}
            return {
                range: new monaco.Range(lineNumber, 0, lineNumber, 3),
                options: {
                    before: {
                        content: versionCountText,
                        inlineClassName: "ghostHighlightBlue"
                    },
                },
            };
        }

        let newDecorations: monaco.editor.IModelDeltaDecoration[] = []
        if (versionCounts) {
            newDecorations = versionCounts.map((versionCount: number, index: number) => {
                return createDecoration(index + 1, versionCount)
            })
        } else {
            for (let lineNumber = 1; lineNumber <= this.vcsTextModel.getLineCount(); lineNumber++) {
                newDecorations.push(createDecoration(lineNumber))
            }
        }

        this.decorations.set(newDecorations)
    }
}