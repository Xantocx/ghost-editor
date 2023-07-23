import { BrowserWindow } from "electron"

import { VCSResponse, BasicVCSServer, VCSBlockId, VCSBlockInfo, VCSBlockRange, VCSBlockUpdate, VCSCopyBlockInfo, VCSFileId, VCSFileLoadingOptions, VCSChildBlockInfo, VCSRootBlockInfo, VCSSessionId, VCSTagInfo, VCSTagId, VCSSessionCreationRequest, VCSSessionRequest, VCSFileData, VCSOperation } from "../app/components/vcs/vcs-rework"
import { ChangeSet, LineChange, MultiLineChange } from "../app/components/data/change"

import { ResourceManager, ISessionFile, ISessionBlock, ISessionTag, Session, ISessionLine, ISessionVersion, DBSession } from "./vcs/db/utilities"
import { FileProxy, LineProxy, VersionProxy, BlockProxy, TagProxy } from "./vcs/db/types"

/*
USAGE:
    - DB: const server = new VCSServer<FileProxy, LineProxy, VersionProxy, BlockProxy, TagProxy, DBSession>(DBSession)
*/

export abstract class VCSServer<SessionFile extends ISessionFile, SessionLine extends ISessionLine, SessionVersion extends ISessionVersion<SessionLine>, SessionBlock extends ISessionBlock<SessionFile, SessionBlock, SessionLine, SessionTag>, SessionTag extends ISessionTag, QuerySession extends Session<SessionFile, SessionLine, SessionVersion, SessionBlock, SessionTag>> extends BasicVCSServer {

    private readonly resources: ResourceManager<SessionFile, SessionLine, SessionVersion, SessionBlock, SessionTag, QuerySession>

    public constructor(sessionConstructor: new (manager: ResourceManager<SessionFile, SessionLine, SessionVersion, SessionBlock, SessionTag, QuerySession>) => QuerySession, browserWindow?: BrowserWindow) {
        super()
        this.resources     = new ResourceManager<SessionFile, SessionLine, SessionVersion, SessionBlock, SessionTag, QuerySession>(sessionConstructor)
        this.browserWindow = browserWindow
    }

    // helper for preview update
    protected readonly browserWindow: BrowserWindow | undefined
    protected abstract updatePreview(session: QuerySession, blockId: VCSBlockId): Promise<void>

    private async updateLine(session: QuerySession, blockId: VCSBlockId, change: LineChange): Promise<VCSBlockId[]> {
        const block = await session.getBlock(blockId)
        const line  = await block.updateLine(change.lineNumber, change.lineText)
        
        await this.updatePreview(session, blockId)

        const ids = await line.getBlockIds()
        return ids.map(id => VCSBlockId.createFrom(blockId, id))
    }

    private async updateLines(session: QuerySession, blockId: VCSBlockId, change: MultiLineChange): Promise<VCSBlockId[]> {
        const block          = await session.getBlock(blockId)
        const affectedBlocks = await block.updateLines(blockId, change)

        this.updatePreview(session, blockId)

        return affectedBlocks
    }



    public async createSession(request: VCSSessionCreationRequest): Promise<VCSResponse<VCSSessionId>> {
        const sessionId = this.resources.createSession()
        return { requestId: request.requestId, response: sessionId }
    }

    public async closeSession(request: VCSSessionRequest<void>): Promise<VCSResponse<void>> {
        return await this.resources.createQuery(request, VCSOperation.CloseSession, async (session) => {
            session.close()
        })
    }

    public async waitForCurrentRequests(request: VCSSessionRequest<void>): Promise<VCSResponse<void>> {
        return await this.resources.createQuery(request, VCSOperation.WaitForCurrentRequests, async () => {})
    }

    public async loadFile(request: VCSSessionRequest<{ options: VCSFileLoadingOptions }>): Promise<VCSResponse<VCSRootBlockInfo>> {
        return await this.resources.createQuery(request, VCSOperation.LoadFile, async (session, { options }) => {
            return await session.loadFile(options)
        })
    }

    public async updateFilePath(request: VCSSessionRequest<{ fileId: VCSFileId; filePath: string; }>): Promise<VCSResponse<VCSFileId>> {
        return await this.resources.createQuery(request, VCSOperation.UpdateFilePath, async (session, { fileId, filePath }) => {
            return await session.updateFilePath(fileId, filePath)
        })
    }

    public async getFileData(request: VCSSessionRequest<{ fileId: VCSFileId }>): Promise<VCSResponse<VCSFileData>> {
        // TODO: fix VCSOperation eventually
        return await this.resources.createQuery(request, VCSOperation.GetBlockInfo, async (session, { fileId }) => {
            return await session.getFileData(fileId)
        })
    }

    public async unloadFile(request: VCSSessionRequest<{ fileId: VCSFileId }>): Promise<VCSResponse<void>> {
        return await this.resources.createQuery(request, VCSOperation.UnloadFile, async (session, { fileId }) => {
            session.unloadFile(fileId)
        })
    }

    public async getText(request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<string>> {
        return await this.resources.createQuery(request, VCSOperation.GetText, async (session, { blockId }) => {
            const block = await session.getBlock(blockId)
            return await block.getText()
        })
    }

    public async getRootText(request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<string>> {
        return await this.resources.createQuery(request, VCSOperation.GetRootText, async (session, { blockId }) => {
            const root  = session.getFileRootBlockFor(blockId)
            const block = await session.getBlock(blockId)
            return await root.getText([block])
        })
    }

    public async lineChanged(request: VCSSessionRequest<{ blockId: VCSBlockId, change: LineChange }>): Promise<VCSResponse<VCSBlockId[]>> {
        return await this.resources.createQuery(request, VCSOperation.LineChanged, async (session, { blockId, change }) => {
            return await this.updateLine(session, blockId, change)
        })
    }

    public async linesChanged(request: VCSSessionRequest<{ blockId: VCSBlockId, change: MultiLineChange }>): Promise<VCSResponse<VCSBlockId[]>> {
        return await this.resources.createQuery(request, VCSOperation.LinesChanged, async (session, { blockId, change }) => {
            return await this.updateLines(session, blockId, change)
        })
    }

    public override async applyChanges(request: VCSSessionRequest<{ blockId: VCSBlockId; changes: ChangeSet; }>): Promise<VCSResponse<VCSBlockId[]>> {
        return await this.resources.createQuery(request, VCSOperation.ApplyChanges, async (session, { blockId, changes }) => {
            const blockIds = []
            for (const change of changes) {
                if      (change instanceof LineChange)      { blockIds.push(await this.updateLine(session, blockId, change)) }
                else if (change instanceof MultiLineChange) { blockIds.push(await this.updateLines(session, blockId, change)) }
                else                                        { throw new Error("Provided change is not in known format!") }
            }
            return blockIds.flat()
        })
    }

    public async copyBlock(request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSCopyBlockInfo>> {
        return await this.resources.createQuery(request, VCSOperation.CopyBlock, async (session, { blockId }) => {
            const block = await session.getBlock(blockId)
            const copy  = await block.copy()
            return await copy.asBlockInfo(blockId)
        })
    }

    public async createChild(request: VCSSessionRequest<{ parentBlockId: VCSBlockId, range: VCSBlockRange }>): Promise<VCSResponse<VCSChildBlockInfo | null>> {
        return await this.resources.createQuery(request, VCSOperation.CreateChild, async (session, { parentBlockId, range }) => {
            const block = await session.getBlock(parentBlockId)
            const child  = await block.createChild(range)
            return child ? await child.asBlockInfo(parentBlockId) : null
        })
    }

    public async deleteBlock(request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<void>> {
        return await this.resources.createQuery(request, VCSOperation.DeleteBlock, async (session, { blockId }) => {
            await session.delete(blockId)
        })
    }

    public async getBlockInfo(request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSBlockInfo>> {
        return await this.resources.createQuery(request, VCSOperation.GetBlockInfo, async (session, { blockId }) => {
            const block = await session.getBlock(blockId)
            return await block.asBlockInfo(blockId)
        })
    }

    public async getChildrenInfo(request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSBlockInfo[]>> {
        return await this.resources.createQuery(request, VCSOperation.GetChildrenInfo, async (session, { blockId }) => {
            const block = await session.getBlock(blockId)
            return await block.getChildrenInfo(blockId)
        })
    }

    public async updateBlock(request: VCSSessionRequest<{ blockId: VCSBlockId, update: VCSBlockUpdate }>): Promise<VCSResponse<void>> {
        throw new Error("Currently, blocks cannot be updated because its unused and I cannot be bothered to actually implement that nightmare.")
    }

    public async setBlockVersionIndex(request: VCSSessionRequest<{ blockId: VCSBlockId, versionIndex: number }>): Promise<VCSResponse<string>> {
        const blockId = request.data.blockId
        return await this.resources.createQueryChain(`set-block-version-index-${blockId.sessionId}-${blockId.filePath}-${blockId.blockId}`, request, VCSOperation.SetBlockVersionIndex, async (session, { blockId, versionIndex }) => {
            const { root, block } = await session.getRootBlockFor(blockId)
            await block.applyIndex(versionIndex)
            await this.updatePreview(session, blockId)
            return await root.getText()
        }, async (session) => {
            // console.log("Chain Broke")
            const block = await session.getBlock(blockId)
            await block.cloneOutdatedHeads()
        })
    }

    public async saveCurrentBlockVersion(request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSTagInfo>> {
        return await this.resources.createQuery(request, VCSOperation.SaveCurrentBlockVersion, async (session, { blockId }) => {
            const block = await session.getBlock(blockId)
            const tag   = await block.createTag()
            return await tag.asTagInfo(blockId)
        })
    }

    public async applyTag(request: VCSSessionRequest<{ tagId: VCSTagId, blockId: VCSBlockId }>): Promise<VCSResponse<VCSBlockInfo>> {
        // TODO: Should the frontend or backend evaluate that blocks and tags fit together? Or do we assume I can apply any tag to any block?
        return await this.resources.createQuery(request, VCSOperation.ApplyTag, async (session, { tagId, blockId }) => {
            const tag   = await session.getTag(tagId)
            const block = await session.getBlock(blockId)
            await block.applyTimestamp(tag.timestamp)
            return await block.asBlockInfo(blockId)
        })
    }
}

export class DBVCSServer extends VCSServer<FileProxy, LineProxy, VersionProxy, BlockProxy, TagProxy, DBSession> {

    public constructor(browserWindow?: BrowserWindow) {
        super(DBSession, browserWindow)
    }

    protected async updatePreview(session: DBSession, blockId: VCSBlockId): Promise<void> {
        if (this.browserWindow) {

            const { root, block } = await session.getRootBlockFor(blockId)

            const lines = root.getActiveLines([block])

            const versionCounts = lines.map(line => line.versions.length)
            const text          = await root.getText([block])
            
            this.browserWindow!.webContents.send("update-vcs-preview", root.id, text, versionCounts)
        }
    }
}