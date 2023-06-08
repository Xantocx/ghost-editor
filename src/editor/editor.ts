import { GhostEditor } from "./ui/views/editor/editor"
import { Synchronizer } from "./utils/synchronizer"

const editorElement = document.getElementById('editor')

if (editorElement) {
    const synchronizer = new Synchronizer()
    const editor       = new GhostEditor(editorElement, { synchronizer, enableFileManagement: true, enableSideView: true })
} else {
    console.error("FATAL ERROR: No editor element in HTML")
}