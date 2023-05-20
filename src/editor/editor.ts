import "./utils/environment"

import * as monaco from "monaco-editor"
import { Editor, Disposable, Model, URI, Selection, IRange } from "./utils/types"
import { LoadFileEvent } from "./utils/events"
import { GhostSnapshot } from "./ui/snapshot/snapshot"
import { ReferenceProvider } from "./utils/line-locator"
import { ChangeBehaviour, ChangeSet, LineChange } from "../app/components/data/change"
import { SnapshotUUID, VCSClient } from "../app/components/vcs/vcs-provider"
import { P5JSPreview } from "./ui/views/previews/p5js-preview"
import { Preview } from "./ui/views/previews/preview"
import { VCSPreview } from "./ui/views/previews/vcs-preview"
import { MetaView, ViewIdentifier } from "./ui/views/meta-view"
import { VersionsView } from "./ui/views/versions-view"
import { VCSVersion } from "../app/components/data/snapshot"

export class GhostEditor implements ReferenceProvider {

    public readonly root: HTMLElement
    public readonly core: Editor

    public metaView: MetaView
    public viewIdentifiers: Record<string, ViewIdentifier>
    private defaultSideView: ViewIdentifier

    private keybindings: Disposable[] = []
    private snapshots: GhostSnapshot[] = []

    public get model(): Model {
        let model = this.core.getModel()

        if (!model) {
            model = monaco.editor.createModel("")
            this.core.setModel(model)
        }

        return model
    }

    public get uri(): URI {
        return this.model.uri
    }

    public get path(): string | null {
        return this.uri.scheme === 'file' ? this.uri.fsPath : null
    }

    public get value(): string {
        return this.core.getValue()
    }

    public get modelOptions(): monaco.editor.TextModelResolvedOptions {
        return this.model.getOptions()
    }

    public get topLine() : number {
        return this.core.getVisibleRanges()[0].startLineNumber
    }

    public get lineHeight(): number {
        // https://github.com/microsoft/monaco-editor/issues/794
        return this.core.getOption(monaco.editor.EditorOption.lineHeight)
    }

    public get fontInfo(): monaco.editor.FontInfo {
        return this.core.getOption(monaco.editor.EditorOption.fontInfo)
    }

    public get characterWidth(): number {
        return this.fontInfo.typicalHalfwidthCharacterWidth
    }

    public get spaceWidth(): number {
        return this.fontInfo.spaceWidth
    }

    public get tabSize(): number {
        return this.modelOptions.tabSize
    }

    public get eol(): string {
        const EOL = this.model.getEndOfLineSequence()
        switch(EOL) {
            case 0: return "\n"
            case 1: return "\r\n"
            default: throw new Error(`Unknown end of line sequence! Got ${EOL}`)
        }
    }

    public get vcs(): VCSClient {
        return window.vcs
    }

    public constructor(rootElement: HTMLElement) {
        this.root = rootElement
        this.core = monaco.editor.create(rootElement, {
            value: '',
            automaticLayout: true
        });

        this.setup()
    }

    private setup(): void {
        this.setupElectronCommunication()
        this.setupContentEvents()
        this.setupShortcuts()
        this.setupMetaView()

        // load empty new file
        this.vcs.loadFile(null, this.eol, this.value)
    }

    private setupElectronCommunication(): void {
        window.ipcRenderer.on('load-file' , (response: LoadFileEvent) => {
            this.loadFile(response.path, response.content)
        })

        window.ipcRenderer.on('save' , () => {
            this.save()
        })
    }

    private manualContentChange = false
    private setupContentEvents(): void {

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

        /*
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
        */
    }

    private setupShortcuts(): void {

        const parent = this

        // precondition keys
        const hasSnapshotSelection = "hasSnapshotSelection"
        const hasSnapshotSelectionKey = this.core.createContextKey<boolean>(hasSnapshotSelection, false);
        this.core.onDidChangeCursorPosition((event) => {
            const snapshots = this.getSnapshots(event.position.lineNumber)
            hasSnapshotSelectionKey.set(snapshots.length > 0);
        });


        // keybindings
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
                //parent.preview.update(parent.value)
                parent.metaView.update(parent.viewIdentifiers.p5js, parent.value)
            },
        }))

        // https://microsoft.github.io/monaco-editor/playground.html?source=v0.37.1#example-interacting-with-the-editor-adding-an-action-to-an-editor-instance
        this.keybindings.push(this.core.addAction({
            id: "ghost-tracking",
            label: "Add/Remove Snapshot",
            keybindings: [
                monaco.KeyMod.Alt | monaco.KeyCode.KeyY,
            ],
            precondition: undefined, // maybe add condition for selection
            keybindingContext: "editorTextFocus",
            contextMenuGroupId: "z_ghost", // z for last spot in order
            contextMenuOrder: 1,
        
            run: function (core) {

                const selection = parent.getSelection()
                const position = parent.getCursorPosition()

                let range: IRange | undefined = undefined
                let snapshots: GhostSnapshot[] | undefined = undefined

                if (selection) {
                    range = selection
                    snapshots = parent.getOverlappingSnapshots(selection)
                } else if (position) {
                    const lineNumber = position.lineNumber
                    range = new monaco.Range(lineNumber, 1, lineNumber, Number.MAX_SAFE_INTEGER)
                    snapshots = parent.getSnapshots(lineNumber)
                }

                if (snapshots) {
                    if (snapshots.length === 0 && range) {
                        parent.createSnapshot(range)
                    } else if (snapshots.length === 1) {
                        parent.deleteSnapshot(snapshots[0].uuid)
                    } else {
                        console.warn("Cannot handle multiple overlapping snapshots for creation or deletion right now!")
                    }
                } else {
                    console.warn("Could not extract correct selection of cursor position to create or delete snapshot!")
                }
            },
        }));

        this.keybindings.push(this.core.addAction({
            id: "ghost-menu",
            label: "Show Ghost Menu",
            keybindings: [
                monaco.KeyMod.Alt | monaco.KeyCode.KeyX,
            ],
            precondition: hasSnapshotSelection, // maybe add condition for selection
            keybindingContext: undefined,
            contextMenuGroupId: "z_ghost", // z for last spot in order
            contextMenuOrder: 2,
        
            run: function (core) {
                const lineNumber = parent.core.getPosition()?.lineNumber
                const snapshots: GhostSnapshot[] = lineNumber ? parent.getSnapshots(lineNumber) : []
                snapshots.forEach(snapshot => snapshot.toggleMenu())
            },
        }));
    }

    private setupMetaView(): void {
        const secondaryViewContainer = document.getElementById("preview")!
        this.metaView = new MetaView(secondaryViewContainer)

        const vcsPreview = this.metaView.addView("vcs", root => {
            return new VCSPreview(root, this.model)
        }, (view: VCSPreview, model: Model) => {
            view.updateEditor(model)
        })

        const p5jsPreview = this.metaView.addView("p5js", root => {
            return new P5JSPreview(root)
        }, (view: P5JSPreview, code: string) => {
            view.update(code)
        })

        const versionsView = this.metaView.addView("versions", root => {
            return new VersionsView(root)
        }, (view: VersionsView, versions: VCSVersion[]) => {
            view.showVersions(versions)
        })

        this.viewIdentifiers = this.metaView.identifiers
        this.defaultSideView = this.viewIdentifiers.vcs
        this.showDefaultSideView()
    }

    public showDefaultSideView(): void {
        this.metaView.showView(this.defaultSideView)
    }

    public unloadFile(): void {
        this.removeSnapshots()
        this.vcs.unloadFile()
    }

    public async loadFile(filePath: string, content: string): Promise<void> {

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
        this.metaView.update(this.viewIdentifiers.vcs, model)

        this.vcs.loadFile(filePath, this.eol, content)
        const snapshots = await this.vcs.getSnapshots()

        this.snapshots = snapshots.map(snapshot => {
            return new GhostSnapshot(this, snapshot)
        })
    }

    public update(text: string): void {
        this.manualContentChange = true
        this.core.setValue(text)
        this.manualContentChange = false

        this.snapshots.forEach(snapshot => {
            snapshot.manualUpdate()
        })
    }

    public save(): void {
        // TODO: make sure files without a path can be saved at new path!
        window.ipcRenderer.invoke('save-file', { path: this.path, content: this.value })
        if (this.path) this.vcs.updatePath(this.path)
    }

    public getSelection(): Selection | null  {
        return this.core.getSelection()
    }

    public getCursorPosition(): monaco.Position | null {
        return this.core.getPosition()
    }

    public async createSnapshot(range: IRange): Promise<GhostSnapshot | null> {
        const overlappingSnapshot = this.snapshots.find(snapshot => snapshot.overlapsWith(range))

        if (!overlappingSnapshot){
            const snapshot = await GhostSnapshot.create(this, range)

            if (snapshot) { 
                this.snapshots.push(snapshot)
            } else {
                console.warn("Failed to create snapshot!")
            }

            return snapshot
        } else {
            console.warn(`You cannot create a snapshot overlapping with ${overlappingSnapshot.snapshot.uuid}}!`)
            return null
        }
    }

    public deleteSnapshot(uuid: SnapshotUUID): GhostSnapshot | undefined {
        const snapshot = this.getSnapshot(uuid)
        snapshot?.delete()

        if (snapshot) {
            const index = this.snapshots.indexOf(snapshot, 0)
            if (index > -1) { this.snapshots.splice(index, 1) }
        }

        return snapshot
    }

    public getSnapshot(uuid: string): GhostSnapshot | undefined {
        return this.snapshots.find(snapshot => { return snapshot.uuid === uuid })
    }

    public getSnapshots(lineNumber: number): GhostSnapshot[] {
        return this.snapshots.filter(snapshot => { return snapshot.containsLine(lineNumber) })
    }

    public getOverlappingSnapshots(range: IRange): GhostSnapshot[] {
        return this.snapshots.filter(snapshot => snapshot.overlapsWith(range))
    }

    public removeSnapshots(): void {
        this.snapshots.forEach(snapshot => snapshot.remove())
        this.snapshots = []
    }
}



const editorElement = document.getElementById('editor')

if (editorElement) {
    const editor = new GhostEditor(editorElement)
} else {
    console.error("FATAL ERROR: No editor element in HTML")
}