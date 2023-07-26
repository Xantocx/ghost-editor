import { ipcMain } from "electron"
import { VCSAdapter, AdaptableVCSServer, VCSTagId, VCSFileLoadingOptions, VCSFileId, VCSBlockId, VCSBlockRange, VCSBlockUpdate, VCSSessionCreationRequest, VCSSessionRequest } from "../../provider"
import { AnyChange, ChangeSet, LineChange, MultiLineChange } from "../../data-types/change"

export default class ElectronVCSServer<Adapter extends VCSAdapter> extends AdaptableVCSServer<Adapter> {

    public static readonly createSessionChannel           = "vcs-create-session"
    public static readonly closeSessionChannel            = "vcs-close-session"
    public static readonly waitForCurrentRequestsChannel  = "vcs-wait-for-current-requests"

    public static readonly loadFileChannel                = "vcs-load-file"
    public static readonly updateFilePathChannel          = "vcs-update-file-path"
    public static readonly unloadFileChannel              = "vcs-unload-file"

    public static readonly getTextChannel                 = "vcs-get-text"
    public static readonly getRootTextChannel             = "vcs-get-root-text"

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
    public static readonly syncBlocksChannel              = "vcs-sync-blocks"
    public static readonly setBlockVersionIndexChannel    = "vcs-set-block-version-index"

    public static readonly saveCurrentBlockVersionChannel = "vcs-save-current-block-version"
    public static readonly applyTagChannel                = "vcs-apply-tag"

    public static readonly getErrorHintChannel            = "vcs-get-error-hint"

    constructor(adapter: Adapter) {
        super(adapter)
        this.mapChannels()
    }

    private mapChannels() {

        ipcMain.handle(ElectronVCSServer.createSessionChannel, (event, request: VCSSessionCreationRequest) => {
            return this.createSession(request)
        })

        ipcMain.handle(ElectronVCSServer.closeSessionChannel, (event, request: VCSSessionRequest<void>) => {
            return this.closeSession(request)
        })

        ipcMain.handle(ElectronVCSServer.waitForCurrentRequestsChannel, (event, request: VCSSessionRequest<void>) => {
            return this.waitForCurrentRequests(request)
        })

        ipcMain.handle(ElectronVCSServer.loadFileChannel, (event, request: VCSSessionRequest<{ options: VCSFileLoadingOptions }>) => {
            return this.loadFile(request)
        })

        ipcMain.handle(ElectronVCSServer.updateFilePathChannel, (event, request: VCSSessionRequest<{ fileId: VCSFileId, filePath: string }>) => {
            return this.updateFilePath(request)
        })

        ipcMain.handle(ElectronVCSServer.unloadFileChannel, (event, request: VCSSessionRequest<{ fileId: VCSFileId }>) => {
            return this.unloadFile(request)
        })

        ipcMain.handle(ElectronVCSServer.getTextChannel, (event, request: VCSSessionRequest<{ blockId: VCSBlockId }>) => {
            return this.getText(request)
        })

        ipcMain.handle(ElectronVCSServer.getRootTextChannel, (event, request: VCSSessionRequest<{ blockId: VCSBlockId }>) => {
            return this.getRootText(request)
        })

        ipcMain.handle(ElectronVCSServer.lineChangedChannel, (event, request: VCSSessionRequest<{ blockId: VCSBlockId, change: LineChange }>) => {
            return this.lineChanged(request)
        })

        ipcMain.handle(ElectronVCSServer.linesChangedChannel, (event, request: VCSSessionRequest<{ blockId: VCSBlockId, change: MultiLineChange }>) => {
            return this.linesChanged(request)
        })

        ipcMain.handle(ElectronVCSServer.applyChangeChannel, (event, request: VCSSessionRequest<{ blockId: VCSBlockId, change: AnyChange }>) => {
            return this.applyChange(request)
        })

        ipcMain.handle(ElectronVCSServer.applyChangesChannel, (event, request: VCSSessionRequest<{ blockId: VCSBlockId, changes: ChangeSet }>) => {
            return this.applyChanges(request)
        })

        ipcMain.handle(ElectronVCSServer.copyBlockChannel, (event, request: VCSSessionRequest<{ blockId: VCSBlockId }>) => {
            return this.copyBlock(request)
        })

        ipcMain.handle(ElectronVCSServer.createChildChannel, (event, request: VCSSessionRequest<{ parentBlockId: VCSBlockId, range: VCSBlockRange }>) => {
            return this.createChild(request)
        })

        ipcMain.handle(ElectronVCSServer.deleteBlockChannel, (event, request: VCSSessionRequest<{ blockId: VCSBlockId }>) => {
            return this.deleteBlock(request)
        })

        ipcMain.handle(ElectronVCSServer.getBlockInfoChannel, (event, request: VCSSessionRequest<{ blockId: VCSBlockId }>) => {
            return this.getBlockInfo(request)
        })

        ipcMain.handle(ElectronVCSServer.getChildrenInfoChannel, (event, request: VCSSessionRequest<{ blockId: VCSBlockId }>) => {
            return this.getChildrenInfo(request)
        })

        ipcMain.handle(ElectronVCSServer.updateBlockChannel, (event, request: VCSSessionRequest<{ blockId: VCSBlockId, update: VCSBlockUpdate }>) => {
            return this.updateBlock(request)
        })

        ipcMain.handle(ElectronVCSServer.syncBlocksChannel, (event, request: VCSSessionRequest<{ source: VCSBlockId, target: VCSBlockId }>) => {
            return this.syncBlocks(request)
        })

        ipcMain.handle(ElectronVCSServer.setBlockVersionIndexChannel, (event, request: VCSSessionRequest<{ blockId: VCSBlockId, versionIndex: number }>) => {
            return this.setBlockVersionIndex(request)
        })

        ipcMain.handle(ElectronVCSServer.saveCurrentBlockVersionChannel, (event, request: VCSSessionRequest<{ blockId: VCSBlockId, name?: string, description?: string, codeForAi?: string }>) => {
            return this.saveCurrentBlockVersion(request)
        })

        ipcMain.handle(ElectronVCSServer.applyTagChannel, (event, request: VCSSessionRequest<{ tagId: VCSTagId, blockId: VCSBlockId }>) => {
            return this.applyTag(request)
        })

        ipcMain.handle(ElectronVCSServer.getErrorHintChannel, (event, request: VCSSessionRequest<{ code: string, errorMessage: string }>) => {
            return this.getErrorHint(request)
        })
    }
}