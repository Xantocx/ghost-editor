import * as monaco from "monaco-editor"
import { Preview } from "./preview";
import { Model } from "../../utils/types";

export class VCSPreview extends Preview {

    private editorModel: Model
    private vcsModel: Model

    private readonly diffEditor: monaco.editor.IStandaloneDiffEditor

    constructor(root: HTMLElement, editorModel: Model, vcsCode?: string) {
        super(root)

        this.diffEditor = monaco.editor.createDiffEditor(this.root, {
            enableSplitViewResizing: true,
            automaticLayout: true,
        });

        this.updateEditor(editorModel)

        window.ipcRenderer.on("update-vcs-preview", code => {
            this.updateVCS(code)
        })
    }

    public updateEditor(model: Model): void {

        this.editorModel = model
        this.vcsModel = monaco.editor.createModel("", model.getLanguageId())

        this.diffEditor.setModel({ 
            original: this.editorModel,
            modified: this.vcsModel
         })
    }

    public updateVCS(code: string): void {
        this.vcsModel.setValue(code)
    }
}