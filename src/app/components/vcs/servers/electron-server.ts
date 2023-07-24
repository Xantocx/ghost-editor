import { ipcMain } from "electron"
import { VCSAdapter, AdaptableVCSServer, VCSTagId, VCSFileLoadingOptions, VCSFileId, VCSBlockId, VCSBlockRange, VCSBlockUpdate, VCSSessionCreationRequest, VCSSessionRequest } from "../vcs-rework"
import { AnyChange, ChangeSet, LineChange, MultiLineChange } from "../../data/change"

export class ElectronVCSServer<Adapter extends VCSAdapter> extends AdaptableVCSServer<Adapter> {

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
    public static readonly setBlockVersionIndexChannel    = "vcs-set-block-version-index"

    public static readonly saveCurrentBlockVersionChannel = "vcs-save-current-block-version"
    public static readonly applyTagChannel                = "vcs-apply-tag"

    public static readonly getErrorHintChannel            = "vcs-get-error-hint"

    constructor(adapter: Adapter) {
        super(adapter)
        this.mapChannels()
    }

    private mapChannels() {

        ipcMain.handle(ElectronVCSServer.createSessionChannel, async (event, request: VCSSessionCreationRequest) => {
            return await this.createSession(request)
        })

        ipcMain.handle(ElectronVCSServer.closeSessionChannel, async (event, request: VCSSessionRequest<void>) => {
            return await this.closeSession(request)
        })

        ipcMain.handle(ElectronVCSServer.waitForCurrentRequestsChannel, async (event, request: VCSSessionRequest<void>) => {
            return await this.waitForCurrentRequests(request)
        })

        ipcMain.handle(ElectronVCSServer.loadFileChannel, async (event, request: VCSSessionRequest<{ options: VCSFileLoadingOptions }>) => {
            return await this.loadFile(request)
        })

        ipcMain.handle(ElectronVCSServer.updateFilePathChannel, async (event, request: VCSSessionRequest<{ fileId: VCSFileId, filePath: string }>) => {
            return await this.updateFilePath(request)
        })

        ipcMain.handle(ElectronVCSServer.unloadFileChannel, async (event, request: VCSSessionRequest<{ fileId: VCSFileId }>) => {
            return await this.unloadFile(request)
        })

        ipcMain.handle(ElectronVCSServer.getTextChannel, async (event, request: VCSSessionRequest<{ blockId: VCSBlockId }>) => {
            return await this.getText(request)
        })

        ipcMain.handle(ElectronVCSServer.getRootTextChannel, async (event, request: VCSSessionRequest<{ blockId: VCSBlockId }>) => {
            return await this.getRootText(request)
        })

        ipcMain.handle(ElectronVCSServer.lineChangedChannel, async (event, request: VCSSessionRequest<{ blockId: VCSBlockId, change: LineChange }>) => {
            return await this.lineChanged(request)
        })

        ipcMain.handle(ElectronVCSServer.linesChangedChannel, async (event, request: VCSSessionRequest<{ blockId: VCSBlockId, change: MultiLineChange }>) => {
            return await this.linesChanged(request)
        })

        ipcMain.handle(ElectronVCSServer.applyChangeChannel, async (event, request: VCSSessionRequest<{ blockId: VCSBlockId, change: AnyChange }>) => {
            return await this.applyChange(request)
        })

        ipcMain.handle(ElectronVCSServer.applyChangesChannel, async (event, request: VCSSessionRequest<{ blockId: VCSBlockId, changes: ChangeSet }>) => {
            return await this.applyChanges(request)
        })

        ipcMain.handle(ElectronVCSServer.copyBlockChannel, async (event, request: VCSSessionRequest<{ blockId: VCSBlockId }>) => {
            return await this.copyBlock(request)
        })

        ipcMain.handle(ElectronVCSServer.createChildChannel, async (event, request: VCSSessionRequest<{ parentBlockId: VCSBlockId, range: VCSBlockRange }>) => {
            return await this.createChild(request)
        })

        ipcMain.handle(ElectronVCSServer.deleteBlockChannel, async (event, request: VCSSessionRequest<{ blockId: VCSBlockId }>) => {
            return await this.deleteBlock(request)
        })

        ipcMain.handle(ElectronVCSServer.getBlockInfoChannel, async (event, request: VCSSessionRequest<{ blockId: VCSBlockId }>) => {
            return await this.getBlockInfo(request)
        })

        ipcMain.handle(ElectronVCSServer.getChildrenInfoChannel, async (event, request: VCSSessionRequest<{ blockId: VCSBlockId }>) => {
            return await this.getChildrenInfo(request)
        })

        ipcMain.handle(ElectronVCSServer.updateBlockChannel, async (event, request: VCSSessionRequest<{ blockId: VCSBlockId, update: VCSBlockUpdate }>) => {
            return await this.updateBlock(request)
        })

        ipcMain.handle(ElectronVCSServer.setBlockVersionIndexChannel, async (event, request: VCSSessionRequest<{ blockId: VCSBlockId, versionIndex: number }>) => {
            return await this.setBlockVersionIndex(request)
        })

        ipcMain.handle(ElectronVCSServer.saveCurrentBlockVersionChannel, async (event, request: VCSSessionRequest<{ blockId: VCSBlockId }>) => {
            return await this.saveCurrentBlockVersion(request)
        })

        ipcMain.handle(ElectronVCSServer.applyTagChannel, async (event, request: VCSSessionRequest<{ tagId: VCSTagId, blockId: VCSBlockId }>) => {
            return await this.applyTag(request)
        })

        ipcMain.handle(ElectronVCSServer.getErrorHintChannel, async (event, request: VCSSessionRequest<{ code: string, errorMessage: string }>) => {
            return await this.getErrorHint(request)
        })
    }
}