import { BrowserWindow } from "electron"

import { VCSResponse, BasicVCSServer, VCSBlockId, VCSBlockInfo, VCSBlockRange, VCSBlockUpdate, VCSCopyBlockInfo, VCSFileId, VCSFileLoadingOptions, VCSChildBlockInfo, VCSRootBlockInfo, VCSSessionId, VCSTagInfo, VCSTagId, VCSUnwrappedText, VCSSessionCreationRequest, VCSSessionRequest, VCSFileData } from "../app/components/vcs/vcs-rework"
import { ChangeSet, LineChange, MultiLineChange } from "../app/components/data/change"

import { QueryType, ResourceManager, ISessionFile, ISessionBlock, ISessionTag, Session, ISessionLine, ISessionVersion, DBSession } from "./vcs/db/utilities"
import { prismaClient } from "./vcs/db/client"
import { FileProxy, LineProxy, VersionProxy, BlockProxy, TagProxy } from "./vcs/db/types"

/*
USAGE:
    - DB: const server = new VCSServer<FileProxy, LineProxy, VersionProxy, BlockProxy, TagProxy, DBSession>(DBSession)
*/

export abstract class VCSServer<SessionFile extends ISessionFile, SessionLine extends ISessionLine, SessionVersion extends ISessionVersion<SessionLine>, SessionBlock extends ISessionBlock<SessionFile, SessionLine, SessionVersion>, SessionTag extends ISessionTag, QuerySession extends Session<SessionFile, SessionLine, SessionVersion, SessionBlock, SessionTag>> extends BasicVCSServer {

    private readonly resources: ResourceManager<SessionFile, SessionLine, SessionVersion, SessionBlock, SessionTag, QuerySession>

    public constructor(sessionConstructor: new (manager: ResourceManager<SessionFile, SessionLine, SessionVersion, SessionBlock, SessionTag, QuerySession>) => QuerySession, browserWindow?: BrowserWindow) {
        super()
        this.resources     = new ResourceManager<SessionFile, SessionLine, SessionVersion, SessionBlock, SessionTag, QuerySession>(sessionConstructor)
        this.browserWindow = browserWindow
    }

    // helper for preview update
    protected readonly browserWindow: BrowserWindow | undefined
    protected abstract updatePreview(block: SessionBlock): Promise<void>

    private async changeLine(session: QuerySession, blockId: VCSBlockId, change: LineChange): Promise<VCSBlockId[]> {
        const block = await session.getBlock(blockId)
        const line  = await block.updateLine(change.lineNumber, change.lineText)
        
        await this.updatePreview(block)

        const ids = await line.getBlockIds()
        return ids.map(id => VCSBlockId.createFrom(blockId, id))
    }

    private async changeLines(session: QuerySession, blockId: VCSBlockId, change: MultiLineChange): Promise<VCSBlockId[]> {
        const block = await session.getBlock(blockId)
        const result = await block.changeLines(blockId, change)
        this.updatePreview(block)
        return result
    }



    public async createSession(request: VCSSessionCreationRequest): Promise<VCSResponse<VCSSessionId>> {
        const sessionId = this.resources.createSession()
        return { requestId: request.requestId, response: sessionId }
    }

    public async closeSession(request: VCSSessionRequest<void>): Promise<VCSResponse<void>> {
        return await this.resources.createQuery(request, QueryType.ReadOnly, async (session) => {
            session.close()
        })
    }

    public async waitForCurrentRequests(request: VCSSessionRequest<void>): Promise<VCSResponse<void>> {
        return await this.resources.createQuery(request, QueryType.Silent, async () => {})
    }

    public async loadFile(request: VCSSessionRequest<{ options: VCSFileLoadingOptions }>): Promise<VCSResponse<VCSRootBlockInfo>> {
        return await this.resources.createQuery(request, QueryType.ReadWrite, async (session, { options }) => {
            return await session.loadFile(options)
        })
    }

    public async getFileData(request: VCSSessionRequest<{ fileId: VCSFileId }>): Promise<VCSResponse<VCSFileData>> {
        return await this.resources.createQuery(request, QueryType.ReadOnly, async (session, { fileId }) => {
            return await session.getFileData(fileId)
        })
    }

    public async unloadFile(request: VCSSessionRequest<{ fileId: VCSFileId }>): Promise<VCSResponse<void>> {
        return await this.resources.createQuery(request, QueryType.ReadOnly, async (session, { fileId }) => {
            session.unloadFile(fileId)
        })
    }

    public async getText(request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<string>> {
        return await this.resources.createQuery(request, QueryType.ReadOnly, async (session, { blockId }) => {
            const block = await session.getBlock(blockId)
            return await block.getText()
        })
    }

    public async getUnwrappedText(request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSUnwrappedText>> {
        return await this.resources.createQuery(request, QueryType.ReadOnly, async (session, { blockId }) => {
            const block = await session.getBlock(blockId)
            return await block.getUnwrappedText()
        })
    }

    public async lineChanged(request: VCSSessionRequest<{ blockId: VCSBlockId, change: LineChange }>): Promise<VCSResponse<VCSBlockId[]>> {
        return await this.resources.createQuery(request, QueryType.ReadWrite, async (session, { blockId, change }) => {
            return await this.changeLine(session, blockId, change)
        })
    }

    public async linesChanged(request: VCSSessionRequest<{ blockId: VCSBlockId, change: MultiLineChange }>): Promise<VCSResponse<VCSBlockId[]>> {
        return await this.resources.createQuery(request, QueryType.ReadWrite, async (session, { blockId, change }) => {
            return await this.changeLines(session, blockId, change)
        })
    }

    public override async applyChanges(request: VCSSessionRequest<{ blockId: VCSBlockId; changes: ChangeSet; }>): Promise<VCSResponse<VCSBlockId[]>> {
        return await this.resources.createQuery(request, QueryType.ReadWrite, async (session, { blockId, changes }) => {
            const blockIds = []
            for (const change of changes) {
                if      (change instanceof LineChange)      { blockIds.push(await this.changeLine(session, blockId, change)) }
                else if (change instanceof MultiLineChange) { blockIds.push(await this.changeLines(session, blockId, change)) }
                else                                        { throw new Error("Provided change is not in known format!") }
            }
            return blockIds.flat()
        })
    }

    public async copyBlock(request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSCopyBlockInfo>> {
        return await this.resources.createQuery(request, QueryType.ReadWrite, async (session, { blockId }) => {
            const block = await session.getBlock(blockId)
            const copy  = await block.copy()
            return await copy.asBlockInfo(blockId)
        })
    }

    public async createChild(request: VCSSessionRequest<{ parentBlockId: VCSBlockId, range: VCSBlockRange }>): Promise<VCSResponse<VCSChildBlockInfo>> {
        return await this.resources.createQuery(request, QueryType.ReadWrite, async (session, { parentBlockId, range }) => {
            const block = await session.getBlock(parentBlockId)
            const child  = await block.createChild(range)
            return await child.asBlockInfo(parentBlockId)
        })
    }

    public async deleteBlock(request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<void>> {
        return await this.resources.createQuery(request, QueryType.ReadWrite, async (session, { blockId }) => {
            await session.delete(blockId)
        })
    }

    public async getBlockInfo(request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSBlockInfo>> {
        return await this.resources.createQuery(request, QueryType.ReadOnly, async (session, { blockId }) => {
            const block = await session.getBlock(blockId)
            return await block.asBlockInfo(blockId)
        })
    }

    public async getChildrenInfo(request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSBlockInfo[]>> {
        return await this.resources.createQuery(request, QueryType.ReadOnly, async (session, { blockId }) => {
            const block = await session.getBlock(blockId)
            return await block.getChildrenInfo(blockId)
        })
    }

    public async updateBlock(request: VCSSessionRequest<{ blockId: VCSBlockId, update: VCSBlockUpdate }>): Promise<VCSResponse<void>> {
        throw new Error("Currently, blocks cannot be updated because its unused and I cannot be bothered to actually implement that nightmare.")
    }

    /*
    public async setBlockVersionIndex(request: VCSSessionRequest<{ blockId: VCSBlockId, versionIndex: number }>): Promise<VCSResponse<string>> {
        return await this.resources.createQuery(request, QueryType.ReadWrite, async (session, { blockId, versionIndex }) => {
            const root  = session.getRootBlockFor(blockId)
            const block = await session.getBlock(blockId)
            const newHeads = await block.applyIndex(versionIndex)
            await this.updatePreview(block)
            return await root.getText()
        })
    }
    */

    protected headsToBeTracked: SessionVersion[] = []
    protected abstract trackHeads(heads: SessionVersion[]): void

    public async setBlockVersionIndex(request: VCSSessionRequest<{ blockId: VCSBlockId, versionIndex: number }>): Promise<VCSResponse<string>> {
        const blockId = request.data.blockId
        return await this.resources.createQueryChain(`set-block-version-index-${blockId.sessionId}-${blockId.filePath}-${blockId.blockId}`, request, QueryType.ReadWrite, async (session, { blockId, versionIndex }) => {
            const root  = session.getRootBlockFor(blockId)
            const block = await session.getBlock(blockId)
            const newHeads = await block.applyIndex(versionIndex)
            this.trackHeads(newHeads)
            await this.updatePreview(block)
            return await root.getText()
        }, async (session) => {
            console.log("Chain Broke: " + this.headsToBeTracked.length)
            const block = await session.getBlock(blockId)
            await block.cloneOutdatedHeads(this.headsToBeTracked)
            this.headsToBeTracked = []
        })
    }

    public async saveCurrentBlockVersion(request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSTagInfo>> {
        throw new Error("Currently, block versions cannot be saved. I will implement that as soon as I can verify that the rest works!")
    }

    public async applyTag(request: VCSSessionRequest<{ tagId: VCSTagId, blockId: VCSBlockId }>): Promise<VCSResponse<VCSBlockInfo>> {
        // TODO: Should the frontend or backend evaluate that blocks and tags fit together? Or do we assume I can apply any tag to any block?
        return await this.resources.createQuery(request, QueryType.ReadWrite, async (session, { tagId, blockId }) => {
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

    protected async updatePreview(block: BlockProxy): Promise<void> {
        if (this.browserWindow) {

            const potentiallyActiveHeads = await prismaClient.version.groupBy({
                by: ["lineId"],
                where: {
                    line: {
                        fileId: block.file.id,
                        blocks: { some: { id: block.id } }
                    },
                    timestamp: { lte: block.timestamp }
                },
                _max: { timestamp: true }
            })

            const lines = await prismaClient.line.findMany({
                where: {
                    OR: potentiallyActiveHeads.map(({ lineId, _max: maxAggregations }) => {
                        return {
                            id: lineId,
                            versions: {
                                some: {
                                    timestamp: maxAggregations.timestamp
                                }
                            }
                        }
                    })
                },
                orderBy: {
                    order: "asc"
                },
                include: {
                    versions: true
                }
            })

            const versionCounts = lines.map(line => line.versions.length)
            const text          = await block.getText()
            
            this.browserWindow!.webContents.send("update-vcs-preview", block.id, text, versionCounts)
        }
    }

    protected trackHeads(heads: VersionProxy[]): void {
        const updatesHeads = this.headsToBeTracked.map(currentHead => {
            const newHeadIndex = heads.findIndex(newHead => newHead.line.id === currentHead.line.id)
            if (newHeadIndex >= 0) {
                const head = heads[newHeadIndex]
                heads.splice(newHeadIndex, 1)
                return head
            } else {
                return currentHead
            }
        })

        // attach any heads for lines that were previously not changed
        this.headsToBeTracked = updatesHeads.concat(heads)
    }
}