import { BlockType } from "./data-types/enums"
import { randomUUID } from "crypto"
import { VCSBlockId, VCSBlockInfo, VCSBlockRange, VCSFileData, VCSFileId, VCSFileLoadingOptions, VCSRootBlockInfo, VCSSessionId, VCSSessionRequest, VCSTagId, VCSOperation, VCSOperationTypes, VCSTagInfo, VCSResponse } from "../provider"
import { MultiLineChange } from "../data-types/change"

import QueryManager from "./utils/query-manager"
import ResourceManager from "./resource-manager"

export interface ISessionFile {
    updateFilePath(filePath: string): Promise<void>
}

export interface ISessionBlock<SessionFile extends ISessionFile, SessionBlock extends ISessionBlock<SessionFile, SessionBlock, SessionLine, SessionTag>, SessionLine extends ISessionLine, SessionTag extends ISessionTag> {
    blockId:   string
    file:      SessionFile
    type:      BlockType
    timestamp: number
    parent?:   SessionBlock

    getFileRoot(): Promise<SessionBlock>
    getRoot(): Promise<SessionBlock>

    asBlockInfo(fileId: VCSFileId): Promise<VCSBlockInfo>
    getChildrenInfo(blockId: VCSBlockId): Promise<VCSBlockInfo[]>

    getText(clonesToConsider?: this[]): Promise<string>

    updateLine(lineNumber: number, content: string): Promise<SessionLine>
    updateLines(fileId: VCSFileId, change: MultiLineChange): Promise<VCSBlockId[]>

    applyIndex(index: number): Promise<void>
    applyTimestamp(timestamp: number): Promise<void>
    cloneOutdatedHeads(): Promise<number>

    copy(): Promise<SessionBlock>
    createChild(range: VCSBlockRange): Promise<SessionBlock | null>

    createTag(options?: { name?: string, description?: string, codeForAi?: string }): Promise<SessionTag>
}

export interface ISessionLine {
    getBlockIds(): Promise<string[]>
}

export interface ISessionVersion<SessionLine extends ISessionLine> {
    line: SessionLine
}

export interface ISessionTag {
    timestamp: number

    asTagInfo(blockId: VCSBlockId): Promise<VCSTagInfo>
}

export type NewFileInfo<SessionFile extends ISessionFile, SessionLine extends ISessionLine, SessionBlock extends ISessionBlock<SessionFile, SessionBlock, SessionLine, SessionTag>, SessionTag extends ISessionTag> = { file: { filePath: string; file: SessionFile }; rootBlock: { blockId: string; block: SessionBlock } }

export default abstract class Session<SessionFile extends ISessionFile, SessionLine extends ISessionLine, SessionVersion extends ISessionVersion<SessionLine>, SessionBlock extends ISessionBlock<SessionFile, SessionBlock, SessionLine, SessionTag>, SessionTag extends ISessionTag> {

    public readonly id = randomUUID()
    public readonly resources: ResourceManager<SessionFile, SessionLine, SessionVersion, SessionBlock, SessionTag, Session<SessionFile, SessionLine, SessionVersion, SessionBlock, SessionTag>>
    public readonly queries:   QueryManager<SessionFile, SessionLine, SessionVersion, SessionBlock, SessionTag, this>   // TODO: Move query manager to ResourceManager? How to handle the inaccessibility of request data otherwise... -> slower: every operation handled by the same queue

    private readonly files  = new Map<string, SessionBlock>() // this may be called files, but refers to the root block for each file - due to the implementation, this name makes most sense though
    private readonly blocks = new Map<string, SessionBlock>() // a cache for previously loaded blocks to speed up performance
    private readonly tags   = new Map<string, SessionTag>()

    public constructor(resourceManager: ResourceManager<SessionFile, SessionLine, SessionVersion, SessionBlock, SessionTag, Session<SessionFile, SessionLine, SessionVersion, SessionBlock, SessionTag>>) {
        this.resources = resourceManager
        this.queries   = new QueryManager(this)
    }

    public abstract createSessionFile(filePath: string | undefined, eol: string, content?: string): Promise<NewFileInfo<SessionFile, SessionLine, SessionBlock, SessionTag>>
    public abstract getRootSessionBlockFor(filePath: string):                                       Promise<SessionBlock | undefined>
    public abstract getSessionBlockFor(blockId: VCSBlockId):                                        Promise<SessionBlock | undefined>
    public abstract getSessionTagFor(tagId: VCSTagId):                                              Promise<SessionTag | undefined>
    public abstract deleteSessionBlock(block: SessionBlock):                                        Promise<void>

    public abstract getFileData(fileId: VCSFileId): Promise<VCSFileData>

    public async loadFile(options: VCSFileLoadingOptions): Promise<VCSRootBlockInfo> {
        const sessionId = this.asId()

        if (options.filePath !== undefined) {
            const filePath = options.filePath
            const fileId   = VCSFileId.createFrom(sessionId, filePath)

            if (this.files.has(filePath)) {
                return await this.files.get(filePath).asBlockInfo(fileId)
            } else {
                const sessions = this.resources.getSessions()
                if (sessions.some((session: Session<SessionFile, SessionLine, SessionVersion, SessionBlock, SessionTag>) => session.id !== this.id && session.files.has(filePath))) {
                    throw new Error(`Cannot load file ${filePath}! Currently in use by another session.`)
                }

                const rootBlock = await this.getRootSessionBlockFor(filePath)

                if (rootBlock) {
                    this.files.set(filePath, rootBlock)
                    this.blocks.set(rootBlock.blockId, rootBlock)
                    return await rootBlock.asBlockInfo(fileId)
                }
            }
        }
        
        // in every other case:
        const { file, rootBlock } = await this.createSessionFile(options.filePath, options.eol, options.content)
        this.files.set(file.filePath, rootBlock.block)
        this.blocks.set(rootBlock.blockId, rootBlock.block)

        const fileId = VCSFileId.createFrom(sessionId, file.filePath)
        return await rootBlock.block.asBlockInfo(fileId)
    }

    public async updateFilePath(fileId: VCSFileId, newFilePath: string): Promise<VCSFileId> {
        const file = this.getFile(fileId)
        await file.updateFilePath(newFilePath)

        const oldFilePath = fileId.filePath
        const rootBlock   = this.getFileRootBlockFor(fileId)

        this.files.delete(oldFilePath)
        this.files.set(newFilePath, rootBlock)

        return new VCSFileId(this.id, newFilePath)
    }

    public unloadFile(fileId: VCSFileId): void {
        this.files.delete(fileId.filePath)
    }

    public getFile(fileId: VCSFileId): SessionFile {
        const filePath = fileId.filePath
        if (this.files.has(filePath)) {
            return this.files.get(filePath).file
        } else {
            throw new Error("File appears to not have been loaded!")
        }
    }

    public async getBlock(blockId: VCSBlockId): Promise<SessionBlock> {
        const id = blockId.blockId
        if (this.blocks.has(id)) {
            return this.blocks.get(id)
        } else {
            const block = await this.getSessionBlockFor(blockId)
            if (!block) { throw new Error(`Cannot find block for provided block id "${id}"`) }
            this.blocks.set(id, block)
            return block
        }
    }

    public async getTag(tagId: VCSTagId): Promise<SessionTag> {
        const id = tagId.tagId
        if (this.tags.has(id)) {
            return this.tags.get(id)
        } else {
            const tag = await this.getSessionTagFor(tagId)
            if (!tag) { throw new Error(`Cannot find tag for provided tag id "${id}"`) }
            this.tags.set(id, tag)
            return tag
        }
    }

    public getFileRootBlockFor(fileId: VCSFileId): SessionBlock {
        const filePath = fileId.filePath
        if (this.files.has(filePath)) {
            return this.files.get(filePath)
        } else {
            throw new Error(`Cannot return root block for unloaded file ${filePath}!`)
        }
    }

    public async getRootBlockFor(blockId: VCSBlockId): Promise<{ root: SessionBlock, block: SessionBlock }> {
        const block = await this.getBlock(blockId)
        const root  = await block.getRoot()

        return { root, block }
    }

    public async createQuery<RequestData, QueryResult>(request: VCSSessionRequest<RequestData>, queryType: VCSOperation, query: (session: this, data: RequestData) => QueryResult | Promise<QueryResult>): Promise<VCSResponse<QueryResult>> {
        const requestType = VCSOperationTypes.get(queryType)
        return this.queries.createQuery(request, requestType, query)
    }

    public async createQueryChain<RequestData, QueryResult>(chainId: string, request: VCSSessionRequest<RequestData>, queryType: VCSOperation, query: (session: this, data: RequestData) => QueryResult | Promise<QueryResult>, onChainInterrupt: (session: this) => void | Promise<void>): Promise<VCSResponse<QueryResult>> {
        const requestType = VCSOperationTypes.get(queryType)
        return this.queries.createQueryChain(chainId, request, requestType, query, onChainInterrupt)
    }

    public async delete(blockId: VCSBlockId): Promise<void> {
        const block = await this.getBlock(blockId)
        if (block.type === BlockType.ROOT) {
            this.unloadFile(blockId)
        } else {
            await this.deleteSessionBlock(block)
        }
    }

    public asId(): VCSSessionId {
        return new VCSSessionId(this.id)
    }

    public close(): void {
        this.resources.closeSession(this.asId())
    }
}