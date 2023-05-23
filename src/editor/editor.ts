import "./utils/environment"

import * as monaco from "monaco-editor"
import { Editor, Disposable, Model, URI, Selection, IRange } from "./utils/types"
import { LoadFileEvent } from "./utils/events"
import { GhostSnapshot } from "./ui/snapshot/snapshot"
import { ReferenceProvider } from "./utils/line-locator"
import { ChangeSet } from "../app/components/data/change"
import { SnapshotUUID, VCSClient } from "../app/components/vcs/vcs-provider"
import { P5JSPreview } from "./ui/views/previews/p5js-preview"
import { VCSPreview } from "./ui/views/previews/vcs-preview"
import { MetaView, ViewIdentifier } from "./ui/views/meta-view"
import { VersionManagerView } from "./ui/views/version-views/version-manager"
import { VCSVersion } from "../app/components/data/snapshot"

export class GhostEditor implements ReferenceProvider {

    public readonly root: HTMLElement
    public readonly core: Editor

    public metaView: MetaView
    public viewIdentifiers: Record<string, ViewIdentifier>
    private defaultSideView: ViewIdentifier

    private keybindings: Disposable[] = []
    private snapshots: GhostSnapshot[] = []

    private selectedRange:     IRange | undefined = undefined
    public  selectedSnapshots: GhostSnapshot[]    = []

    private _activeSnapshot: GhostSnapshot | undefined = undefined
    public  get activeSnapshot(): GhostSnapshot | undefined { return this._activeSnapshot }
    public  set activeSnapshot(snapshot: GhostSnapshot | undefined) {
        if (snapshot === this.activeSnapshot) { 
            this.activeSnapshot?.updateVersionManager()
        } else {
            this._activeSnapshot?.hideVersionManager()
            this._activeSnapshot = snapshot
            this._activeSnapshot?.showVersionManager()
        }

        this.updateShortcutPreconditions(true)
    }

    private hasActiveSnapshot = "hasActiveSnapshot"
    private canShowSelectedSnapshot = "canShowSelectedSnapshot"
    private canCreateSnapshot = "canCreateSnapshot"
    private canDeleteSnapshot = "canDeleteSnapshot"

    private hasActiveSnapshotKey: monaco.editor.IContextKey<boolean>
    private canShowSelectedSnapshotKey: monaco.editor.IContextKey<boolean>
    private canCreateSnapshotKey: monaco.editor.IContextKey<boolean>
    private canDeleteSnapshotKey: monaco.editor.IContextKey<boolean>

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

        const curserSubscription = this.core.onDidChangeCursorPosition(async event => {
            const lineNumber = this.core.getPosition()?.lineNumber
            this.snapshots.forEach(snapshot => {
                if (lineNumber && snapshot.containsLine(lineNumber)) {
                    snapshot.showMenu()
                } else if (!snapshot.menuActive) {
                    snapshot.hideMenu()
                }
            })
        })
    }

    private setupShortcutPreconditions(): void {
        this.hasActiveSnapshotKey       = this.core.createContextKey<boolean>(this.hasActiveSnapshot, false);
        this.canShowSelectedSnapshotKey = this.core.createContextKey<boolean>(this.canShowSelectedSnapshot, false);
        this.canCreateSnapshotKey       = this.core.createContextKey<boolean>(this.canCreateSnapshot, false);
        this.canDeleteSnapshotKey       = this.core.createContextKey<boolean>(this.canDeleteSnapshot, false);

        this.core.onDidChangeCursorPosition((event) => { this.updateShortcutPreconditions() });
    }

    private setupShortcuts(): void {

        this.setupShortcutPreconditions()

        const parent = this

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
            id: "ghost-create-snapshot",
            label: "Create Snapshot",
            keybindings: [
                monaco.KeyMod.Alt | monaco.KeyCode.KeyY,
            ],
            precondition: this.canCreateSnapshot, // maybe add condition for selection
            keybindingContext: "editorTextFocus",
            contextMenuGroupId: "z_ghost", // z for last spot in order
            contextMenuOrder: 1,
        
            run: function (core) {
                parent.canCreateSnapshotKey.set(false)
                parent.createSnapshot(parent.selectedRange!)
                    .then(() => parent.updateShortcutPreconditions())
            },
        }));

        this.keybindings.push(this.core.addAction({
            id: "ghost-remove-snapshot",
            label: "Remove Snapshot",
            keybindings: [
                monaco.KeyMod.Alt | monaco.KeyCode.KeyY,
            ],
            precondition: this.canDeleteSnapshot, // maybe add condition for selection
            keybindingContext: "editorTextFocus",
            contextMenuGroupId: "z_ghost", // z for last spot in order
            contextMenuOrder: 1,
        
            run: function (core) {
                parent.deleteSnapshot(parent.selectedSnapshots[0].uuid)
                parent.updateShortcutPreconditions()
            },
        }));

        this.keybindings.push(this.core.addAction({
            id: "ghost-show-versions",
            label: "Show Versions",
            keybindings: [
                monaco.KeyMod.Alt | monaco.KeyCode.KeyX,
            ],
            precondition: this.canShowSelectedSnapshot,
            keybindingContext: "editorTextFocus",
            contextMenuGroupId: "z_ghost", // z for last spot in order
            contextMenuOrder: 2,
        
            run: function (core) {
                const lineNumber = parent.core.getPosition()!.lineNumber
                parent.activeSnapshot = parent.getSnapshots(lineNumber)[0] // TODO: How to handle overlap? Even relevant?
            },
        }));

        this.keybindings.push(this.core.addAction({
            id: "ghost-hide-versions",
            label: "Hide Versions",
            keybindings: [
                monaco.KeyMod.Alt | monaco.KeyCode.KeyX,
            ],
            precondition: this.hasActiveSnapshot + " && !" + this.canShowSelectedSnapshot, // maybe add condition for selection
            keybindingContext: "editorTextFocus",
            contextMenuGroupId: "z_ghost", // z for last spot in order
            contextMenuOrder: 2,
        
            run: function (core) {
                parent.activeSnapshot = undefined
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

        const versionManager = this.metaView.addView("versionManager", root => {
            return new VersionManagerView(root)
        }, (view: VersionManagerView, versions: VCSVersion[]) => {
            view.applyDiff(versions)
        })

        this.viewIdentifiers = this.metaView.identifiers
        this.defaultSideView = this.viewIdentifiers.vcs
        this.showDefaultSideView()
    }

    private updateShortcutPreconditions(skipSelectionUpdate?: boolean): void {

        this.hasActiveSnapshotKey.set(this.activeSnapshot !== undefined)

        const position   = this.getCursorPosition()
        const lineNumber = position?.lineNumber
        const snapshots  = lineNumber ? this.getSnapshots(lineNumber) : []
        const snapshot   = snapshots.length > 0 ? snapshots[0] : undefined
        const canShowSelectedSnapshot = snapshot && snapshot !== this.activeSnapshot
        this.canShowSelectedSnapshotKey.set(canShowSelectedSnapshot ? canShowSelectedSnapshot : false);

        if (!skipSelectionUpdate) {
            const selection = this.getSelection()

            if (selection) {
                this.selectedRange = selection
                this.selectedSnapshots = this.getOverlappingSnapshots(selection)
            } else if (position) {
                const lineNumber       = position.lineNumber
                this.selectedRange     = new monaco.Range(lineNumber, 1, lineNumber, Number.MAX_SAFE_INTEGER)
                this.selectedSnapshots = this.getSnapshots(lineNumber)
            } else {
                this.selectedRange     = undefined
                this.selectedSnapshots = []
            }

            this.canCreateSnapshotKey.set(this.selectedSnapshots.length === 0 && this.selectedRange !== undefined)
            this.canDeleteSnapshotKey.set(this.selectedSnapshots.length > 0)
        }
    }

    public showDefaultSideView(): void {
        this.metaView.showView(this.defaultSideView)
    }

    public unloadFile(): void {
        this.selectedRange = undefined
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

        if (snapshot) {
            snapshot.delete()
            
            const index = this.snapshots.indexOf(snapshot, 0)
            if (index > -1) { this.snapshots.splice(index, 1) }

            if (this.activeSnapshot === snapshot) { this.activeSnapshot = undefined }
            else                                  { this.updateShortcutPreconditions() }
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
        this.activeSnapshot = undefined
        this.selectedSnapshots = []
    }
}



const editorElement = document.getElementById('editor')

if (editorElement) {
    const editor = new GhostEditor(editorElement)
} else {
    console.error("FATAL ERROR: No editor element in HTML")
}