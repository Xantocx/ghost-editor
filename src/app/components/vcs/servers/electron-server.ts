import { ipcMain } from "electron"
import { VCSAdapter, AdaptableVCSServer, TagId, SessionId, FileLoadingOptions, FileId, BlockId, BlockRange, BlockUpdate } from "../vcs-rework"
import { IRange } from "../../../../editor/utils/types"
import { VCSSnapshotData } from "../../data/snapshot"
import { AnyChange, ChangeSet, LineChange, MultiLineChange } from "../../data/change"

export class ElectronVCSServer<Adapter extends VCSAdapter> extends AdaptableVCSServer<Adapter> {

    public static createSessionChannel           = "vcs-create-session"
    public static closeSessionChannel            = "vcs-close-session"

    public static loadFileChannel                = "vcs-load-ile"
    public static unloadFileChannel              = "vcs-unload-file"

    public static lineChangedChannel             = "vcs-line-changed"
    public static linesChangedChannel            = "vcs-lines-Changed"
    public static applyChangeChannel             = "vcs-apply-change"
    public static applyChangesChannel            = "vcs-apply-changes"

    public static copyBlockChannel               = "vcs-copy-block"
    public static createChildChannel             = "vcs-create-child-block"
    public static deleteBlockChannel             = "vcs-delete-block"

    public static getBlockInfoChannel            = "vcs-get-block-info"
    public static getChildrenInfoChannel         = "vcs-get-children-info"

    public static updateBlockChannel             = "vcs-update-block"
    public static setBlockVersionIndexChannel    = "vcs-set-block-version-index"

    public static saveCurrentBlockVersionChannel = "vcs-save-current-block-version"

    constructor(adapter: Adapter) {
        super(adapter)
        this.mapChannels()
    }

    private mapChannels() {

        const createSessionSubscription = ipcMain.handle(ElectronVCSServer.createSessionChannel, async (event) => {
            return await this.createSession()
        })

        const closeSessionSubscription = ipcMain.handle(ElectronVCSServer.closeSessionChannel, async (event, sessionId: SessionId) => {
            await this.closeSession(sessionId)
        })

        const loadFileSubscription = ipcMain.handle(ElectronVCSServer.loadFileChannel, async (event, sessionId: SessionId, options: FileLoadingOptions) => {
            return await this.loadFile(sessionId, options)
        })

        const unloadFileSubscription = ipcMain.handle(ElectronVCSServer.unloadFileChannel, async (event, fileId: FileId) => {
            await this.unloadFile(fileId)
        })

        const lineChangedSubscription = ipcMain.handle(ElectronVCSServer.lineChangedChannel, async (event, blockId: BlockId, change: LineChange) => {
            return await this.lineChanged(blockId, change)
        })

        const linesChangedSubscription = ipcMain.handle(ElectronVCSServer.linesChangedChannel, async (event, blockId: BlockId, change: MultiLineChange) => {
            return await this.linesChanged(blockId, change)
        })

        const applyChangeSubscription = ipcMain.handle(ElectronVCSServer.applyChangeChannel, async (event, blockId: BlockId, change: AnyChange) => {
            return await this.applyChange(blockId, change)
        })

        const applyChangesSubscription = ipcMain.handle(ElectronVCSServer.applyChangesChannel, async (event, blockId: BlockId, changes: ChangeSet) => {
            return await this.applyChanges(blockId, changes)
        })

        const copyBlockSubscription = ipcMain.handle(ElectronVCSServer.copyBlockChannel, async (event, blockId: BlockId) => {
            return await this.copyBlock(blockId)
        })

        const createChildSubscription = ipcMain.handle(ElectronVCSServer.createChildChannel, async (event, parentBlockId: BlockId, range: BlockRange) => {
            return await this.createChild(parentBlockId, range)
        })

        const deleteBlockSubscription = ipcMain.handle(ElectronVCSServer.deleteBlockChannel, async (event, blockId: BlockId) => {
            await this.deleteBlock(blockId)
        })

        const getBlockInfoSubscription = ipcMain.handle(ElectronVCSServer.getBlockInfoChannel, async (event, blockId: BlockId) => {
            return await this.getBlockInfo(blockId)
        })

        const getChildrenInfoSubscription = ipcMain.handle(ElectronVCSServer.getChildrenInfoChannel, async (event, blockId: BlockId) => {
            return await this.getChildrenInfo(blockId)
        })

        const updateBlockSubscription = ipcMain.handle(ElectronVCSServer.updateBlockChannel, async (event, blockId: BlockId, update: BlockUpdate) => {
            await this.updateBlock(blockId, update)
        })

        const setBlockVersionIndexSubscription = ipcMain.handle(ElectronVCSServer.setBlockVersionIndexChannel, async (event, blockId: BlockId, versionIndex: number) => {
            return await this.setBlockVersionIndex(blockId, versionIndex)
        })

        const saveCurrentBlockVersionSubscription = ipcMain.handle(ElectronVCSServer.saveCurrentBlockVersionChannel, async (event, blockId: BlockId) => {
            return await this.saveCurrentBlockVersion(blockId)
        })
    }
}