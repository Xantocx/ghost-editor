import { ipcMain } from "electron"
import { VCSAdapter, AdaptableVCSServer, VCSTagId, VCSSessionId, VCSFileLoadingOptions, VCSFileId, VCSBlockId, VCSBlockRange, VCSBlockUpdate, VCSSessionCreationRequest, VCSSessionRequest } from "../vcs-rework"
import { AnyChange, ChangeSet, LineChange, MultiLineChange } from "../../data/change"

export class ElectronVCSServer<Adapter extends VCSAdapter> extends AdaptableVCSServer<Adapter> {

    public static readonly createSessionChannel           = "vcs-create-session"
    public static readonly closeSessionChannel            = "vcs-close-session"

    public static readonly loadFileChannel                = "vcs-load-file"
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

        const createSessionSubscription = ipcMain.handle(ElectronVCSServer.createSessionChannel, async (event, request: VCSSessionCreationRequest) => {
            return await this.createSession(request)
        })

        const closeSessionSubscription = ipcMain.handle(ElectronVCSServer.closeSessionChannel, async (event, request: VCSSessionRequest<void>) => {
            return await this.closeSession(request)
        })

        const loadFileSubscription = ipcMain.handle(ElectronVCSServer.loadFileChannel, async (event, request: VCSSessionRequest<{ options: VCSFileLoadingOptions }>) => {
            return await this.loadFile(request)
        })

        const unloadFileSubscription = ipcMain.handle(ElectronVCSServer.unloadFileChannel, async (event, request: VCSSessionRequest<{ fileId: VCSFileId }>) => {
            return await this.unloadFile(request)
        })

        const getTextSubscription = ipcMain.handle(ElectronVCSServer.getTextChannel, async (event, request: VCSSessionRequest<{ blockId: VCSBlockId }>) => {
            return await this.getText(request)
        })

        const getUnwrappedTextSubscription = ipcMain.handle(ElectronVCSServer.getUnwrappedTextChannel, async (event, request: VCSSessionRequest<{ blockId: VCSBlockId }>) => {
            return await this.getUnwrappedText(request)
        })

        const lineChangedSubscription = ipcMain.handle(ElectronVCSServer.lineChangedChannel, async (event, request: VCSSessionRequest<{ blockId: VCSBlockId, change: LineChange }>) => {
            return await this.lineChanged(request)
        })

        const linesChangedSubscription = ipcMain.handle(ElectronVCSServer.linesChangedChannel, async (event, request: VCSSessionRequest<{ blockId: VCSBlockId, change: MultiLineChange }>) => {
            return await this.linesChanged(request)
        })

        const applyChangeSubscription = ipcMain.handle(ElectronVCSServer.applyChangeChannel, async (event, request: VCSSessionRequest<{ blockId: VCSBlockId, change: AnyChange }>) => {
            return await this.applyChange(request)
        })

        const applyChangesSubscription = ipcMain.handle(ElectronVCSServer.applyChangesChannel, async (event, request: VCSSessionRequest<{ blockId: VCSBlockId, changes: ChangeSet }>) => {
            return await this.applyChanges(request)
        })

        const copyBlockSubscription = ipcMain.handle(ElectronVCSServer.copyBlockChannel, async (event, request: VCSSessionRequest<{ blockId: VCSBlockId }>) => {
            return await this.copyBlock(request)
        })

        const createChildSubscription = ipcMain.handle(ElectronVCSServer.createChildChannel, async (event, request: VCSSessionRequest<{ parentBlockId: VCSBlockId, range: VCSBlockRange }>) => {
            return await this.createChild(request)
        })

        const deleteBlockSubscription = ipcMain.handle(ElectronVCSServer.deleteBlockChannel, async (event, request: VCSSessionRequest<{ blockId: VCSBlockId }>) => {
            return await this.deleteBlock(request)
        })

        const getBlockInfoSubscription = ipcMain.handle(ElectronVCSServer.getBlockInfoChannel, async (event, request: VCSSessionRequest<{ blockId: VCSBlockId }>) => {
            return await this.getBlockInfo(request)
        })

        const getChildrenInfoSubscription = ipcMain.handle(ElectronVCSServer.getChildrenInfoChannel, async (event, request: VCSSessionRequest<{ blockId: VCSBlockId }>) => {
            return await this.getChildrenInfo(request)
        })

        const updateBlockSubscription = ipcMain.handle(ElectronVCSServer.updateBlockChannel, async (event, request: VCSSessionRequest<{ blockId: VCSBlockId, update: VCSBlockUpdate }>) => {
            return await this.updateBlock(request)
        })

        const setBlockVersionIndexSubscription = ipcMain.handle(ElectronVCSServer.setBlockVersionIndexChannel, async (event, request: VCSSessionRequest<{ blockId: VCSBlockId, versionIndex: number }>) => {
            return await this.setBlockVersionIndex(request)
        })

        const saveCurrentBlockVersionSubscription = ipcMain.handle(ElectronVCSServer.saveCurrentBlockVersionChannel, async (event, request: VCSSessionRequest<{ blockId: VCSBlockId }>) => {
            return await this.saveCurrentBlockVersion(request)
        })

        const applyTagSubscription = ipcMain.handle(ElectronVCSServer.applyTagChannel, async (event, request: VCSSessionRequest<{ tagId: VCSTagId, blockId: VCSBlockId }>) => {
            return await this.applyTag(request)
        })
    }
}