import { GhostEditor } from "./ui/views/editor/editor"

const editorElement = document.getElementById('editor')

if (editorElement) {
    const editor = new GhostEditor(editorElement, { enableFileManagement: true, enableSideView: true })
} else {
    console.error("FATAL ERROR: No editor element in HTML")
}