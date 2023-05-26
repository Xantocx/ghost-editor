import "../../../utils/environment"

import * as monaco from "monaco-editor"

import { View } from "../view";
import { MonacoEditor, MonacoModel, MonacoEditorOption, URI, Disposable, IRange, MonacoChangeEvent } from "../../../utils/types";
import { Synchronizable, Synchronizer } from "../../../utils/synchronizer";
import { SessionOptions, SnapshotUUID, VCSClient, VCSSession } from "../../../../app/components/vcs/vcs-provider";
import { MetaView, ViewIdentifier } from "../meta-view";
import { GhostSnapshot } from "../../snapshot/snapshot";
import { SubscriptionManager } from "../../widgets/mouse-tracker";
import { ChangeSet } from "../../../../app/components/data/change";
import { VCSPreview } from "../previews/vcs-preview";
import { P5JSPreview } from "../previews/p5js-preview";
import { VersionManagerView } from "../version/version-manager";
import { VCSVersion } from "../../../../app/components/data/snapshot";
import { LoadFileEvent } from "../../../utils/events";
import { ReferenceProvider } from "../../../utils/line-locator";
import { uuid } from "../../../utils/uuid";
import { extractEOLSymbol } from "../../../utils/helpers";

class GhostEditorSnapshotManager {

    public readonly editor: GhostEditor

    private snapshots: GhostSnapshot[] = []

    public get session():            VCSSession                    { return this.editor.getSession() }
    public get interactionManager(): GhostEditorInteractionManager { return this.editor.interactionManager }

    public constructor(editor: GhostEditor) {
        this.editor = editor
    }

    public async loadSnapshots(): Promise<void> {
        const snapshots = await this.session.getSnapshots()
        this.snapshots = snapshots.map(snapshot => new GhostSnapshot(this.editor, snapshot))
    }

    public async createSnapshot(range: IRange): Promise<GhostSnapshot | null> {
        const overlappingSnapshot = this.snapshots.find(snapshot => snapshot.overlapsWith(range))

        if (!overlappingSnapshot){
            const snapshot = await GhostSnapshot.create(this.editor, range)

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

    public getSnapshot(uuid: string): GhostSnapshot | undefined {
        return this.snapshots.find(snapshot => { return snapshot.uuid === uuid })
    }

    public getSnapshots(lineNumber: number): GhostSnapshot[] {
        return this.snapshots.filter(snapshot => { return snapshot.containsLine(lineNumber) })
    }

    public getOverlappingSnapshots(range: IRange): GhostSnapshot[] {
        return this.snapshots.filter(snapshot => snapshot.overlapsWith(range))
    }

    public forEach(callback: (snaphot: GhostSnapshot, index: number, snapshots: GhostSnapshot[]) => void): void {
        this.snapshots.forEach(callback)
    }

    public deleteSnapshot(uuid: SnapshotUUID): GhostSnapshot | undefined {
        const snapshot = this.getSnapshot(uuid)

        if (snapshot) {
            snapshot.delete()

            const index = this.snapshots.indexOf(snapshot, 0)
            if (index > -1) { this.snapshots.splice(index, 1) }

            if (this.editor.activeSnapshot === snapshot) { this.editor.activeSnapshot = undefined }
            else                                         { this.interactionManager.readEditorState() }
        }

        return snapshot
    }

    public removeSnapshots(): void {
        this.snapshots.forEach(snapshot => snapshot.remove())
        this.snapshots = []
    }
}

class GhostEditorInteractionManager extends SubscriptionManager {

    public  readonly editor: GhostEditor
    private get      core(): MonacoEditor { return this.editor.core }

    private readonly keybindings: Disposable[] = []

    private readonly hasActiveSnapshotId       = "hasActiveSnapshot"
    private readonly canShowSelectedSnapshotId = "canShowSelectedSnapshot"
    private readonly canCreateSnapshotId       = "canCreateSnapshot"
    private readonly canDeleteSnapshotId       = "canDeleteSnapshot"

    private readonly hasActiveSnapshotKey: monaco.editor.IContextKey<boolean>
    private readonly canShowSelectedSnapshotKey: monaco.editor.IContextKey<boolean>
    private readonly canCreateSnapshotKey: monaco.editor.IContextKey<boolean>
    private readonly canDeleteSnapshotKey: monaco.editor.IContextKey<boolean>

    private disableVcsSync: boolean = false

    private selectedRange:     IRange | undefined = undefined
    public  selectedSnapshots: GhostSnapshot[]    = []

    private get activeSnapshot(): GhostSnapshot | undefined         { return this.editor.activeSnapshot }
    private set activeSnapshot(snapshot: GhostSnapshot | undefined) { this.editor.activeSnapshot = snapshot }

    private get snapshotManager(): GhostEditorSnapshotManager { return this.editor.snapshotManager }

    public constructor(editor: GhostEditor) {
        super()
        this.editor = editor

        this.hasActiveSnapshotKey       = this.createContextKey(this.hasActiveSnapshotId,       false);
        this.canShowSelectedSnapshotKey = this.createContextKey(this.canShowSelectedSnapshotId, false);
        this.canCreateSnapshotKey       = this.createContextKey(this.canCreateSnapshotId,       false);
        this.canDeleteSnapshotKey       = this.createContextKey(this.canDeleteSnapshotId,       false);

        this.addSubscription(this.core.onDidChangeModelContent(async event => this.readEditorContent(event)))
        this.addSubscription(this.core.onDidChangeCursorPosition(    event => this.readEditorState({ updateActiveSnapshot: true })));

        this.readEditorState()
        this.setupKeybindings()
    }

    private getSelection():      monaco.Selection | null { return this.core.getSelection() }
    private getCursorPosition(): monaco.Position  | null { return this.core.getPosition() }

    private createContextKey<Type extends monaco.editor.ContextKeyValue>(id: string, defaultValue: Type): monaco.editor.IContextKey<Type> {
        return this.core.createContextKey<Type>(id, defaultValue);
    }

    private setupKeybindings(): void {

        const parent          = this
        const editor          = this.editor
        const core            = this.core
        const snapshotManager = this.snapshotManager

        // https://microsoft.github.io/monaco-editor/playground.html?source=v0.37.1#example-interacting-with-the-editor-adding-an-action-to-an-editor-instance
        // add snapshot to selection
        this.keybindings.push(core.addAction({
            id: "ghost-create-snapshot",
            label: "Create Snapshot",
            keybindings: [
                monaco.KeyMod.Alt | monaco.KeyCode.KeyY,
            ],
            precondition: this.canCreateSnapshotId, // maybe add condition for selection
            keybindingContext: "editorTextFocus",
            contextMenuGroupId: "z_ghost", // z for last spot in order
            contextMenuOrder: 1,
        
            run: function (core) {
                parent.canCreateSnapshotKey.set(false)
                snapshotManager.createSnapshot(parent.selectedRange!)
                    .then(() => parent.readEditorState())
            },
        }));

        // delete selected snapshot
        this.keybindings.push(core.addAction({
            id: "ghost-remove-snapshot",
            label: "Remove Snapshot",
            keybindings: [
                monaco.KeyMod.Alt | monaco.KeyCode.KeyY,
            ],
            precondition: this.canDeleteSnapshotId, // maybe add condition for selection
            keybindingContext: "editorTextFocus",
            contextMenuGroupId: "z_ghost", // z for last spot in order
            contextMenuOrder: 1,
        
            run: function (core) {
                snapshotManager.deleteSnapshot(parent.selectedSnapshots[0].uuid)
                parent.readEditorState()
            },
        }));

        // side view keybindings
        if (editor.sideViewEnabled) {

            // update P5JS Preview
            this.keybindings.push(core.addAction({
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
                    editor.sideView!.update(editor.sideViewIdentifiers!.p5js, editor!.text)
                },
            }))

            // show versions in side view
            this.keybindings.push(core.addAction({
                id: "ghost-show-versions",
                label: "Show Versions",
                keybindings: [
                    monaco.KeyMod.Alt | monaco.KeyCode.KeyX,
                ],
                precondition: this.canShowSelectedSnapshotId,
                keybindingContext: "editorTextFocus",
                contextMenuGroupId: "z_ghost", // z for last spot in order
                contextMenuOrder: 2,
            
                run: function (core) {
                    const lineNumber = core.getPosition()!.lineNumber
                    editor.activeSnapshot = snapshotManager.getSnapshots(lineNumber)[0] // TODO: How to handle overlap? Even relevant?
                },
            }));
    
            // hide versions in side view
            this.keybindings.push(core.addAction({
                id: "ghost-hide-versions",
                label: "Hide Versions",
                keybindings: [
                    monaco.KeyMod.Alt | monaco.KeyCode.KeyX,
                ],
                precondition: this.hasActiveSnapshotId + " && !" + this.canShowSelectedSnapshotId,
                keybindingContext: "editorTextFocus",
                contextMenuGroupId: "z_ghost", // z for last spot in order
                contextMenuOrder: 2,
            
                run: function (core) {
                    editor.activeSnapshot = undefined
                },
            }));
        }
    }

    public readEditorContent(event: MonacoChangeEvent):void {
        if (!this.disableVcsSync) {
            const changeSet = this.editor.createChangeSet(event)
            this.editor.applyChangeSet(changeSet)
        }
    }

    public readEditorState(options?: { skipSelectionUpdate?: boolean, updateActiveSnapshot?: boolean }): void {

        this.hasActiveSnapshotKey.set(this.activeSnapshot !== undefined)

        const position   = this.getCursorPosition()
        const lineNumber = position?.lineNumber
        const snapshots  = lineNumber ? this.snapshotManager.getSnapshots(lineNumber) : []
        const snapshot   = snapshots.length > 0 ? snapshots[0] : undefined
        const canShowSelectedSnapshot = snapshot && snapshot !== this.activeSnapshot
        this.canShowSelectedSnapshotKey.set(canShowSelectedSnapshot ? canShowSelectedSnapshot : false);

        if (!options?.skipSelectionUpdate) {
            const selection = this.getSelection()

            if (selection) {
                this.selectedRange     = selection
                this.selectedSnapshots = this.snapshotManager.getOverlappingSnapshots(selection)
            } else if (position) {
                const lineNumber       = position.lineNumber
                this.selectedRange     = new monaco.Range(lineNumber, 1, lineNumber, Number.MAX_SAFE_INTEGER)
                this.selectedSnapshots = this.snapshotManager.getSnapshots(lineNumber)
            } else {
                this.selectedRange     = undefined
                this.selectedSnapshots = []
            }

            this.canCreateSnapshotKey.set(this.selectedSnapshots.length === 0 && this.selectedRange !== undefined)
            this.canDeleteSnapshotKey.set(this.selectedSnapshots.length > 0)
        }

        if (options?.updateActiveSnapshot) {
            this.editor.snapshotManager.forEach(snapshot => {
                if (lineNumber && snapshot.containsLine(lineNumber)) {
                    snapshot.showMenu()
                } else if (!snapshot.menuActive) {
                    snapshot.hideMenu()
                }
            })
        }
    }

    public withDisabledVcsSync(callback: () => void): void {
        this.disableVcsSync = true
        callback()
        this.disableVcsSync = false
    }

    public unloadFile(): void {
        this.activeSnapshot    = undefined
        this.selectedRange     = undefined
        this.selectedSnapshots = []
    }
}

export class GhostEditorModel {

    public readonly textModel:   MonacoModel
    public readonly session: VCSSession

    public get uri(): URI { return this.textModel.uri }

    public constructor(textModel: MonacoModel, session: VCSSession) {
        this.textModel = textModel
        this.session   = session
    }

    public close(): void {
        this.session.close()
    }
}

export class GhostEditor extends View implements ReferenceProvider {

    public readonly enableFileManagement: boolean
    public readonly sideViewEnabled:      boolean

    // view containers to seperate main editor and side view
    public readonly editorContainer:    HTMLDivElement
    public readonly sideViewContainer?: HTMLDivElement

    // main editor
    public readonly core:               MonacoEditor
    public readonly snapshotManager:    GhostEditorSnapshotManager
    public readonly interactionManager: GhostEditorInteractionManager

    // side view containing previews, versioning views, etc.
    public  sideView?:            MetaView
    public  sideViewIdentifiers?: Record<string, ViewIdentifier>
    private defaultSideView?:     ViewIdentifier

    // data model
    public     editorModel?: GhostEditorModel
    public get hasModel():   boolean { return this.editorModel !== undefined }

    // accessors for editor meta info and content
    public get uri():  URI           { return this.getTextModel().uri }
    public get path(): string | null { return this.uri.scheme === 'file' ? this.uri.fsPath : null }
    public get text(): string        { return this.core.getValue() }

    // accessors for useful config info of the editor
    public get firstVisibleLine(): number { return this.core.getVisibleRanges()[0].startLineNumber }
    public get lineHeight():       number { return this.core.getOption(MonacoEditorOption.lineHeight) } // https://github.com/microsoft/monaco-editor/issues/794
    public get characterWidth():   number { return this.getFontInfo().typicalHalfwidthCharacterWidth }
    public get spaceWidth():       number { return this.getFontInfo().spaceWidth }
    public get tabSize():          number { return this.getModelOptions().tabSize }

    // vcs system allowing for version management
    public get vcs(): VCSClient { return window.vcs }

    // snapshot management
    private _activeSnapshot:      GhostSnapshot | undefined = undefined
    public  get activeSnapshot(): GhostSnapshot | undefined { return this._activeSnapshot }
    public  set activeSnapshot(snapshot: GhostSnapshot | undefined) {
        if (snapshot === this.activeSnapshot) { 
            this.activeSnapshot?.updateVersionManager()
        } else {
            this._activeSnapshot?.hideVersionManager()
            this._activeSnapshot = snapshot
            this._activeSnapshot?.showVersionManager()
        }

        this.interactionManager.readEditorState({ skipSelectionUpdate: true })
    }

    public get selectedSnapshots(): GhostSnapshot[] { return this.interactionManager.selectedSnapshots }

    public static createAsSubview(root: HTMLElement, blockId: string, synchronizer?: Synchronizer): GhostEditor {
        return new GhostEditor(root, { blockId, synchronizer })
    }

    public static createVersionEditor(root: HTMLElement, version: VCSVersion, synchronizer?: Synchronizer): GhostEditor {
        return this.createAsSubview(root, version.blockId, synchronizer)
    }

    public constructor(root: HTMLElement, options?: { filePath?: string, blockId?: string, enableFileManagement?: boolean, enableSideView?: boolean, synchronizer?: Synchronizer }) {
        super(root, options?.synchronizer)

        this.enableFileManagement = options?.enableFileManagement ? options.enableFileManagement : false
        this.sideViewEnabled      = options?.enableSideView       ? options.enableSideView       : false

        // setup root for flex layout
        this.root.style.display       = "flex"
        this.root.style.flexDirection = "row"
        this.root.style.height        = "100%"
        this.root.style.padding       = "0 0"
        this.root.style.margin        = "0 0"

        this.editorContainer = this.addContainer()
        if (this.sideViewEnabled) { this.sideViewContainer = this.addContainer() }
        
        this.core               = monaco.editor.create(this.editorContainer, { value: '', automaticLayout: true  });
        this.snapshotManager    = new GhostEditorSnapshotManager(this)
        this.interactionManager = new GhostEditorInteractionManager(this)

        this.setup()
        this.load({ filePath: options?.filePath, blockId: options?.blockId })
    }

    private createEditorModel(textModel: MonacoModel, session: VCSSession, vcsContent: string): void {
        textModel.setValue(vcsContent)
        this.editorModel = new GhostEditorModel(textModel, session)
        this.core.setModel(textModel)
        if (this.sideViewEnabled) { this.sideView!.update(this.sideViewIdentifiers!.vcs, { editorModel: this.editorModel, vcsContent }) }
    }

    public getTextModel(): MonacoModel {
        if (this.hasModel) { return this.editorModel!.textModel }
        else               { throw new Error("The editor currently has no model. Please load a session in order to re-establish functionality before using this function.") }
    }

    public getSession(): VCSSession {
        if (this.hasModel) { return this.editorModel!.session }
        else               { throw new Error("The editor currently has no session. Please load a session in order to re-establish functionality before using this function.") } 
    }

    // edior and model options to extract config
    public getFontInfo():     monaco.editor.FontInfo                 { return this.core.getOption(MonacoEditorOption.fontInfo) }
    public getModelOptions(): monaco.editor.TextModelResolvedOptions { return this.getTextModel().getOptions() }
    public getEOLSymbol():    string                                 { return extractEOLSymbol(this.getTextModel()) }

    private addContainer(): HTMLDivElement {
        const container = document.createElement("div")
        container.style.boxSizing = "border-box"
        container.style.flex      = "1"
        container.style.maxWidth  = "50%"
        container.style.height    = "100%"
        container.style.padding   = "0 0"
        container.style.margin    = "0 0"
        this.root.appendChild(container)
        return container
    }

    private setup(): void {
        this.setupElectronCommunication()
        this.setupSideView()
    }

    private setupElectronCommunication(): void {
        if (this.enableFileManagement) {
            window.ipcRenderer.on('load-file' , (response: LoadFileEvent) => this.loadFile(response.path, response.content))
            window.ipcRenderer.on('save' ,      ()                        => this.save())
        }
    }

    private setupSideView(): void {
        if (this.sideViewEnabled) {
            this.sideView = new MetaView(this.sideViewContainer!)

            const vcsPreview = this.sideView.addView("vcs", root => {
                return new VCSPreview(root, this.editorModel)
            }, (view: VCSPreview, args: { editorModel: GhostEditorModel, vcsContent?: string }) => {
                view.updateEditor(args.editorModel, args.vcsContent)
            })

            const p5jsPreview = this.sideView.addView("p5js", root => {
                return new P5JSPreview(root)
            }, (view: P5JSPreview, code: string) => {
                view.update(code)
            })

            const versionManager = this.sideView.addView("versionManager", root => {
                return new VersionManagerView(root)
            }, (view: VersionManagerView, versions: VCSVersion[]) => {
                view.applyDiff(versions)
            })

            this.sideViewIdentifiers = this.sideView.identifiers
            this.defaultSideView     = this.sideViewIdentifiers.vcs
            this.showDefaultSideView()
        }
    }

    public showDefaultSideView(): void {
        if (this.sideViewEnabled) { this.sideView!.showView(this.defaultSideView!) }
    }

    public createChangeSet(event: MonacoChangeEvent): ChangeSet {
        return new ChangeSet(Date.now(), this.getTextModel(), this.getEOLSymbol(), event)
    }

    public async applyChangeSet(changeSet: ChangeSet): Promise<void> {
        // forEach is a bitch for anything but synchronous arrays...
        const changedSnapshots = new Set(await this.getSession().applyChanges(changeSet))
        changedSnapshots.forEach(uuid => this.snapshotManager.getSnapshot(uuid)?.update())
    }

    public override sync(trigger: Synchronizable): void {
        throw new Error("Method not implemented.")
    }

    // dangerous method, disconnects the editor from VCS, make sure this never is called indepenedently of a load
    private unload(): void {
        this.snapshotManager.removeSnapshots()
        this.interactionManager.unloadFile()
        this.core.setModel(null)
        this.editorModel?.close()
        this.editorModel = undefined
    }

    private async createSession(eol: string, options?: SessionOptions): Promise<{ session: VCSSession, content: string }> {
        const result = await this.vcs.startSession(eol, options)
        return { session: new VCSSession(result.sessionId, result.blockId, this.vcs), content: result.content }
    }

    public async load(options?: { uri?: URI, filePath?: string, blockId?: string, content?: string }): Promise<void> {
        this.unload()

        const uri      = options?.uri      ? options.uri      : undefined
        const filePath = options?.filePath ? options.filePath : uri?.fsPath
        const blockId  = options?.blockId  ? options.blockId  : undefined
        const content  = options?.content  ? options.content  : ""

        let textModel = uri ? monaco.editor.getModel(uri) : null

        if (textModel) { textModel.setValue(content) }
        else           { textModel = monaco.editor.createModel(content, undefined, uri) }

        const EOL    = extractEOLSymbol(textModel)
        const result = await this.createSession(EOL, { filePath, blockId, content: options?.content })

        this.createEditorModel(textModel, result.session, result.content)

        this.snapshotManager.loadSnapshots()
    }

    public async loadFile(filePath: string, content: string): Promise<void> {
        if (this.enableFileManagement) {
            const uri = monaco.Uri.file(filePath)
            this.load({ uri, content })
        } else {
            throw new Error("This GhostEditor is not configured to support file management! You cannot load a file.")
        }
    }

    public save(): void {
        // TODO: make sure files without a path can be saved at new path!
        if (this.enableFileManagement) {
            if (this.path) {
                window.ipcRenderer.invoke('save-file', { path: this.path, content: this.text })
            } else {
                throw new Error("Currently, we do not support choosing a filename for new files. Sorry.")
                //if (this.path) this.vcs.updatePath(this.path)
            }
        } else {
            throw new Error("This GhostEditor is not configured to support file management! You cannot save a file.")
        }
    }

    public update(text: string): void {
        this.interactionManager.withDisabledVcsSync(() => this.core.setValue(text) )
        this.snapshotManager.forEach(snapshot => snapshot.manualUpdate())
    }
}