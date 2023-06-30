import { ipcMain } from "electron"
import { VCSAdapter, AdaptableVCSServer, VCSTagId, VCSSessionId, VCSFileLoadingOptions, VCSFileId, VCSBlockId, VCSBlockRange, VCSBlockUpdate } from "../vcs-rework"
import { AnyChange, ChangeSet, LineChange, MultiLineChange } from "../../data/change"

export class ElectronVCSServer<Adapter extends VCSAdapter> extends AdaptableVCSServer<Adapter> {

    public static readonly createSessionChannel           = "vcs-create-session"
    public static readonly closeSessionChannel            = "vcs-close-session"

    public static readonly loadFileChannel                = "vcs-load-ile"
    public static readonly unloadFileChannel              = "vcs-unload-file"

    public static readonly getTextChannel                 = "vcs-get-text"
    public static readonly getUnwrappedTextChannel        = "vcs-get-unwrapped-text"

    public static readonly lineChangedChannel             = "vcs-line-changed"
    public static readonly linesChangedChannel            = "vcs-lines-Changed"
    public static readonly applyChangeChannel             = "vcs-apply-change"
    public static readonly applyChangesChannel            = "vcs-apply-changes"

    public static readonly copyBlockChannel               = "vcs-copy-block"
    public static readonly createChildChannel             = "vcs-create-child-block"
    public static readonly deleteBlockChannel             = "vcs-delete-block"

    public static readonly getBlockInfoChannel            = "vcs-get-block-info"
    public static readonly getChildrenInfoChannel         = "vcs-get-children-info"

    public static readonly updateBlockChannel             = "vcs-update-block"
    public static readonly setBlockVersionIndexChannel    = "vcs-set-block-version-index"

    public static readonly saveCurrentBlockVersionChannel = "vcs-save-current-block-version"
    public static readonly applyTagChannel                = "vcs-apply-tag"

    constructor(adapter: Adapter) {
        super(adapter)
        this.mapChannels()
    }

    private mapChannels() {

        const createSessionSubscription = ipcMain.handle(ElectronVCSServer.createSessionChannel, async (event) => {
            return await this.createSession()
        })

        const closeSessionSubscription = ipcMain.handle(ElectronVCSServer.closeSessionChannel, async (event, sessionId: VCSSessionId) => {
            await this.closeSession(sessionId)
        })

        const loadFileSubscription = ipcMain.handle(ElectronVCSServer.loadFileChannel, async (event, sessionId: VCSSessionId, options: VCSFileLoadingOptions) => {
            return await this.loadFile(sessionId, options)
        })

        const unloadFileSubscription = ipcMain.handle(ElectronVCSServer.unloadFileChannel, async (event, fileId: VCSFileId) => {
            await this.unloadFile(fileId)
        })

        const getTextSubscription = ipcMain.handle(ElectronVCSServer.getTextChannel, async (event, blockId: VCSBlockId) => {
            return await this.getText(blockId)
        })

        const getUnwrappedTextSubscription = ipcMain.handle(ElectronVCSServer.getUnwrappedTextChannel, async (event, blockId: VCSBlockId) => {
            return await this.getUnwrappedText(blockId)
        })

        const lineChangedSubscription = ipcMain.handle(ElectronVCSServer.lineChangedChannel, async (event, blockId: VCSBlockId, change: LineChange) => {
            return await this.lineChanged(blockId, change)
        })

        const linesChangedSubscription = ipcMain.handle(ElectronVCSServer.linesChangedChannel, async (event, blockId: VCSBlockId, change: MultiLineChange) => {
            return await this.linesChanged(blockId, change)
        })

        const applyChangeSubscription = ipcMain.handle(ElectronVCSServer.applyChangeChannel, async (event, blockId: VCSBlockId, change: AnyChange) => {
            return await this.applyChange(blockId, change)
        })

        const applyChangesSubscription = ipcMain.handle(ElectronVCSServer.applyChangesChannel, async (event, blockId: VCSBlockId, changes: ChangeSet) => {
            return await this.applyChanges(blockId, changes)
        })

        const copyBlockSubscription = ipcMain.handle(ElectronVCSServer.copyBlockChannel, async (event, blockId: VCSBlockId) => {
            return await this.copyBlock(blockId)
        })

        const createChildSubscription = ipcMain.handle(ElectronVCSServer.createChildChannel, async (event, parentBlockId: VCSBlockId, range: VCSBlockRange) => {
            return await this.createChild(parentBlockId, range)
        })

        const deleteBlockSubscription = ipcMain.handle(ElectronVCSServer.deleteBlockChannel, async (event, blockId: VCSBlockId) => {
            await this.deleteBlock(blockId)
        })

        const getBlockInfoSubscription = ipcMain.handle(ElectronVCSServer.getBlockInfoChannel, async (event, blockId: VCSBlockId) => {
            return await this.getBlockInfo(blockId)
        })

        const getChildrenInfoSubscription = ipcMain.handle(ElectronVCSServer.getChildrenInfoChannel, async (event, blockId: VCSBlockId) => {
            return await this.getChildrenInfo(blockId)
        })

        const updateBlockSubscription = ipcMain.handle(ElectronVCSServer.updateBlockChannel, async (event, blockId: VCSBlockId, update: VCSBlockUpdate) => {
            await this.updateBlock(blockId, update)
        })

        const setBlockVersionIndexSubscription = ipcMain.handle(ElectronVCSServer.setBlockVersionIndexChannel, async (event, blockId: VCSBlockId, versionIndex: number) => {
            return await this.setBlockVersionIndex(blockId, versionIndex)
        })

        const saveCurrentBlockVersionSubscription = ipcMain.handle(ElectronVCSServer.saveCurrentBlockVersionChannel, async (event, blockId: VCSBlockId) => {
            return await this.saveCurrentBlockVersion(blockId)
        })

        const applyTagSubscription = ipcMain.handle(ElectronVCSServer.applyTagChannel, async (event, tagId: VCSTagId, blockId: VCSBlockId) => {
            return await this.applyTag(tagId, blockId)
        })
    }
}