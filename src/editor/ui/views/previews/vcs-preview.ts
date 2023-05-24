import * as monaco from "monaco-editor"
import { Preview } from "./preview";
import { MonacoModel } from "../../../utils/types";

export class VCSPreview extends Preview {

    private editorModel: MonacoModel
    private vcsModel: MonacoModel

    private readonly diffEditor: monaco.editor.IStandaloneDiffEditor
    private readonly decorations: monaco.editor.IEditorDecorationsCollection

    constructor(root: HTMLElement, editorModel: MonacoModel) {
        super(root)

        this.diffEditor = monaco.editor.createDiffEditor(this.root, {
            enableSplitViewResizing: true,
            automaticLayout: true,
            originalEditable: false,
        });

        this.decorations = this.diffEditor.createDecorationsCollection()

        this.updateEditor(editorModel)

        window.ipcRenderer.on("update-vcs-preview", (code: string, versionCounts: number[]) => {
            this.updateVCS(code, versionCounts)
        })
    }

    public updateEditor(model: MonacoModel): void {

        this.editorModel = model
        this.vcsModel = monaco.editor.createModel("", model.getLanguageId())

        this.diffEditor.setModel({ 
            original: this.editorModel,
            modified: this.vcsModel
         })
    }

    public updateVCS(code: string, versionCounts: number[]): void {
        this.vcsModel.setValue(code)
        
        const newDecorations: monaco.editor.IModelDeltaDecoration[] = versionCounts.map((versionCount: number, index: number) => {

            const lineNumber = index + 1
            let   versionCountText = `${versionCount} versions:\t`

            while (versionCountText.length < 14) {
                versionCountText = " " + versionCountText
            }

            return {
                range: new monaco.Range(lineNumber, 0, lineNumber, 3),
                options: {
                    before: {
                        content: versionCountText,
                        inlineClassName: "ghostHighlightBlue"
                    },
                },
            };
        })

        this.decorations.set(newDecorations)
    }
}