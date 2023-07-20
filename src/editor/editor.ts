import { setupP5JS } from "./utils/monaco-language-config"

import { GhostEditor } from "./ui/views/editor/editor"
import { Synchronizer } from "./utils/synchronizer"

setupP5JS()

const editorElement = document.getElementById('editor')

if (editorElement) {
    const synchronizer = new Synchronizer()
    const editor       = new GhostEditor(editorElement, undefined, { synchronizer, enableFileManagement: true, enableSideView: true })
} else {
    throw new Error("No editor element in HTML!")
}