import { BlockType, Block, VersionType, Version, Line, PrismaPromise, Prisma, LineType } from "@prisma/client"
import { DatabaseProxy } from "../database-proxy"
import { prismaClient } from "../../client"
import { FileProxy, LineProxy, TagProxy, VersionProxy } from "../../types"
import { VCSBlockId, VCSBlockInfo, VCSBlockRange, VCSFileId, VCSTagId, VCSTagInfo } from "../../../../../app/components/vcs/vcs-rework"
import { TimestampProvider } from "../../../core/metadata/timestamps"
import { MultiLineChange } from "../../../../../app/components/data/change"
import { ProxyCache } from "../proxy-cache"
import { ISessionBlock } from "../../utilities"


enum BlockReference {
    Previous,
    Next
}

export class BlockProxy extends DatabaseProxy implements ISessionBlock<FileProxy, LineProxy, VersionProxy> {

    public readonly blockId: string
    public readonly file:    FileProxy
    public readonly type:    BlockType

    public firstLine: LineProxy
    public lastLine:  LineProxy

    public parent?: BlockProxy
    public origin?: BlockProxy

    public children: BlockProxy[]
    public clones:   BlockProxy[]
    public tags:     TagProxy[]

    private _timestamp:  number
    public get timestamp(): number{ return this._timestamp }

    public setTimestampManually(newTimestamp: number) {
        this._timestamp = newTimestamp
    }

    public async setTimestamp(newTimestamp: number): Promise<void> {
        const updatedBlock = await prismaClient.block.update({
            where: { id: this.id },
            data:  { timestamp: newTimestamp }
        })

        this._timestamp = updatedBlock.timestamp
    }

    /*
    public setTimestampOnResponsibleChildFor(line: LineProxy, timestamp: number, clonesToConsider?: BlockProxy[]) {
        const child = this.getChildResponsibleFor(line, clonesToConsider)
        return child.setTimestamp(timestamp)
    }
    */

    public static async get(id: number): Promise<BlockProxy> {
        return await ProxyCache.getBlockProxy(id)
    }

    public static async getFor(block: Block): Promise<BlockProxy> {
        return await ProxyCache.getBlockProxyFor(block)
    }

    public static async load(id: number): Promise<BlockProxy> {
        const block = await prismaClient.block.findUniqueOrThrow({ where: { id } })
        return await this.loadFrom(block)
    }

    public static async loadFrom(block: Block): Promise<BlockProxy> {
        const file  = await ProxyCache.getFileProxy(block.fileId)
        const proxy = new BlockProxy(block.id, block.blockId, file, block.type, block.timestamp)

        ProxyCache.registerBlockProxy(proxy)

        // TODO: Blocks without lines are not handled well like this...
        const firstLineData = await prismaClient.line.findFirst({ where: { fileId: file.id, blocks: { some: { id: block.id } } }, orderBy: { order: "asc" } })!
        const lastLineData  = await prismaClient.line.findFirst({ where: { fileId: file.id, blocks: { some: { id: block.id } } }, orderBy: { order: "desc" } })!
        const childrenData  = await prismaClient.block.findMany({ where: { fileId: file.id, parentId: block.id } })
        const cloneData     = await prismaClient.block.findMany({ where: { fileId: file.id, originId: block.id } })
        const tagData       = await prismaClient.tag.findMany({ where: { blockId: block.id } })

        proxy.parent = block.parentId ? await ProxyCache.getBlockProxy(block.parentId) : undefined
        proxy.origin = block.originId ? await ProxyCache.getBlockProxy(block.originId) : undefined

        proxy.firstLine = await LineProxy.getFor(firstLineData)
        proxy.lastLine  = await LineProxy.getFor(lastLineData)

        proxy.children = await Promise.all(childrenData.map(child => BlockProxy.getFor(child)))
        proxy.clones   = await Promise.all(cloneData.map(clone => BlockProxy.getFor(clone)))
        proxy.tags     = await Promise.all(tagData.map(tag => TagProxy.getFor(tag)))

        // NOTES: this is a unique call that is only relevant when a new block is created on already existing/loaded lines -> in this case, this will notify the lines about new blocks
        proxy.getLines().forEach(line => {
            if (!line.blocks.some(block => block.id === proxy.id)) {
                line.blocks.push(proxy)
            }
        })

        return proxy
    }

    private constructor(id: number, blockId: string, file: FileProxy, type: BlockType, timestamp: number) {
        super(id)
        this.blockId    = blockId
        this.file       = file
        this.type       = type
        this._timestamp = timestamp
    }

    // MAGIC: Cache lines + version, all done.
    // !!!!!! TODO: !!!!!!
    // THIS SHOULD BE USED TO CALCULATE HEADS?
    // root block is edited, but versions are only represented through considering children -> heads for this block should always consider children
    // should get a mapping from line to timestamp applicable through the corresponding children -> then map to versions in one opperation
    private getResponsibilityTable(accumulation?: { clonesToConsider?: BlockProxy[], collectedTimestamps?: Map<number, BlockProxy> }): Map<number, BlockProxy> {
        const clonesToConsider     = accumulation?.clonesToConsider
        const collectedTimestamps = accumulation?.collectedTimestamps

        if (clonesToConsider) {
            const clone = clonesToConsider.find(clone => clone.origin.id === this.id)
            if (clone) { return clone.getResponsibilityTable(accumulation) }
        }

        const lines      = this.getLines()
        let   timestamps = collectedTimestamps !== undefined ? collectedTimestamps : new Map<number, BlockProxy>()

        lines.forEach(line => timestamps.set(line.id, this))

        for (const child of this.children) {
            timestamps  = child.getResponsibilityTable({ clonesToConsider, collectedTimestamps: timestamps })
        }

        return timestamps
    }

    public getChildResponsibleFor(line: LineProxy, clonesToConsider?: BlockProxy[]): BlockProxy {
        const table = this.getResponsibilityTable({ clonesToConsider })
        return table.get(line.id)!
    }

    public getLines(): LineProxy[] {
        return this.file.getLinesFor(this)
    }

    public getLinesInRange(range: VCSBlockRange): LineProxy[] {
        const heads       = this.getHeads()
        const activeHeads = heads.filter(head => head.isActive)

        const firstVersion = activeHeads[range.startLine - 1] 
        const lastVersion  = activeHeads[range.endLine - 1] 

        const headsInRange = heads.filter(version => firstVersion.line.order <= version.line.order && version.line.order <= lastVersion.line.order)

        return headsInRange.map(head => head.line)
    }

    public getActiveLines(): LineProxy[] {
        return this.getActiveHeads().map(head => head.line)
    }

    public getActiveLinesInRange(range: VCSBlockRange): LineProxy[] {
        const lines = this.getActiveLines()
        return lines.filter((line, index) => range.startLine <= index + 1 && index + 1 <= range.endLine)
    }

    public getOriginalLines(): LineProxy[] {
        return this.getLines().filter(line => line.type === LineType.ORIGINAL)
    }

    public getHeads(clonesToConsider?: BlockProxy[]): VersionProxy[] {
        const lines = this.getLines()
        const table = this.getResponsibilityTable({ clonesToConsider })
        return lines.map(line => line.getHeadFor(table.get(line.id)!))
    }

    public getActiveHeads(clonesToConsider?: BlockProxy[]): VersionProxy[] {
        return this.getHeads(clonesToConsider).filter(head => head.isActive)
    }

    private getLastImportedVersion(): VersionProxy | null {
        const originalLines    = this.getOriginalLines()
        const importedVersions = originalLines
            .flatMap(line => line.versions.filter(version => version.type === VersionType.IMPORTED))
            .sort((versionA, versionB) => versionB.timestamp - versionA.timestamp)
        
        return importedVersions.length > 0 ? importedVersions[0] : null
    }

    private getTimeline(): VersionProxy[] {
        const versions = this.getLines()
            .flatMap(head => head.versions.filter(version => version.type !== VersionType.IMPORTED && version.type !== VersionType.CLONE))
            .sort((versionA, versionB) => versionA.timestamp - versionB.timestamp)

        const lastImportedVersion = this.getLastImportedVersion()
        if (lastImportedVersion) {
            return [lastImportedVersion].concat(...versions)
        } else {
            return versions
        }
    }

    private getTimelineWithCurrentIndex(): { timeline: VersionProxy[], index: number } {
        const timeline = this.getTimeline()
        for (let index = timeline.length - 1; index >= 0; index--) {
            const version = timeline[index]
            if (version.timestamp <= this.timestamp) { return { timeline, index } }
        }

        throw new Error("Current timestamp of this block is lower than every single timestamp of a version in the timeline. As a consequence, there is no valid index!")
    }

    /*
    //public getBlock()         { return prismaClient.block.findUniqueOrThrow({ where: { id: this.id } }) }
    public getCloneCount()    { return prismaClient.block.count({ where: { originId: this.id } }) }
    public getChildrenCount() { return prismaClient.block.count({ where: { parentId: this.id } }) }
    public getLineCount()     { return prismaClient.line.count({ where: { blocks: { some: { id: this.id } } } }) }
    public getVersionCount()  { return prismaClient.version.count({ where: { line: { blocks: { some: { id: this.id } } }, type: { not: VersionType.CLONE } } }) }
    public getChildren()      { return prismaClient.block.findMany({ where: { parentId: this.id } }) }
    public getLines()         { return prismaClient.line.findMany({ where: { blocks: { some: { id: this.id } } }, orderBy: { order: "asc" } }) }
    //public getHeadList()      { return prismaClient.headList.findFirstOrThrow({ where: { blocks: { some: { id: this.id } } } }) }
    //public getAllVersions() { return prismaClient.version.findMany({ where: { line: { blocks: { some: { id: this.id } } } }, orderBy: { line: { order: "asc" } } }) }
    public getTags()          { return prismaClient.tag.findMany({ where: { blockId: this.id }, include: { block: { select: { blockId: true } } } }) }

    public getOriginalLineCount() {
        return prismaClient.version.count({
            where: {
                line: { blocks: { some: { id: this.id } } },
                type: VersionType.IMPORTED
            }
        })
    }

    public async getHeads(includeLine?: boolean): Promise<{ prismaPromise: PrismaPromise<Version[]> }> {
        const potentiallyActiveHeads = await prismaClient.version.groupBy({
            by: ["lineId"],
            where: {
                line: {
                    fileId: this.file.id,
                    blocks: { some: { id: this.id } }
                },
                timestamp: { lte: this.timestamp }
            },
            _max: { timestamp: true }
        })

        const preInsertionHeads = await prismaClient.version.groupBy({
            by: ["lineId"],
            where: {
                line: {
                    fileId: this.file.id,
                    blocks: { some: { id: this.id } },
                    id:     { notIn: potentiallyActiveHeads.map(aggregation => aggregation.lineId) }
                }
            },
            _min: { timestamp: true }
        })

        const heads: { lineId: number, timestamp: number }[] = []
        potentiallyActiveHeads.forEach(({ lineId, _max: maxAggregations }) => heads.push({ lineId, timestamp: maxAggregations.timestamp }))
        preInsertionHeads.forEach(     ({ lineId, _min: minAggregations }) => heads.push({ lineId, timestamp: minAggregations.timestamp }))

        const versionSearch: Prisma.VersionFindManyArgs<any> = {
            where: {
                OR: heads
            },
            orderBy: {
                line: { order: "asc" }
            }
        }

        if (includeLine) { versionSearch.include = { line: true } }

        return { prismaPromise: prismaClient.version.findMany(versionSearch) }
    }

    // NOTE: Assumes first version of an inserted line is always inactive
    public async getActiveHeads(includeLine?: boolean): Promise<{ prismaPromise: PrismaPromise<Version[]> }> {

        const potentiallyActiveHeads = await prismaClient.version.groupBy({
            by: ["lineId"],
            where: {
                line: {
                    fileId: this.file.id,
                    blocks: { some: { id: this.id } }
                },
                timestamp: { lte: this.timestamp }
            },
            _max: { timestamp: true }
        })

        const versionSearch: Prisma.VersionFindManyArgs<any> = {
            where: {
                OR: potentiallyActiveHeads.map(({ lineId, _max: maxAggregations }) => {
                    return {
                        lineId,
                        timestamp: maxAggregations.timestamp
                    }
                }),
                isActive: true
            },
            orderBy: {
                line: { order: "asc" }
            }
        }

        if (includeLine) { versionSearch.include = { line: true } }

        return { prismaPromise: prismaClient.version.findMany(versionSearch) }
    }

    public async getActiveLineCount(): Promise<{ prismaPromise: PrismaPromise<number> }> {

        const potentiallyActiveHeads = await prismaClient.version.groupBy({
            by: ["lineId"],
            where: {
                line: {
                    fileId: this.file.id,
                    blocks: { some: { id: this.id } }
                },
                timestamp: { lte: this.timestamp }
            },
            _max: { timestamp: true }
        })

        return { prismaPromise: prismaClient.version.count({
            where: {
                OR: potentiallyActiveHeads.map(({ lineId, _max: maxAggregations }) => {
                    return {
                        lineId,
                        timestamp: maxAggregations.timestamp
                    }
                }),
                isActive: true
            }
        })}
    }

    public async getActiveLines(): Promise<{ prismaPromise: PrismaPromise<Line[]> }> {

        const potentiallyActiveHeads = await prismaClient.version.groupBy({
            by: ["lineId"],
            where: {
                line: {
                    fileId: this.file.id,
                    blocks: { some: { id: this.id } }
                },
                timestamp: { lte: this.timestamp }
            },
            _max: { timestamp: true }
        })

        return { prismaPromise: prismaClient.line.findMany({
            where: {
                OR: potentiallyActiveHeads.map(({ lineId, _max: maxAggregations }) => {
                    return {
                        id: lineId,
                        versions: {
                            some: {
                                timestamp: maxAggregations.timestamp,
                                isActive:  true
                            }
                        }
                    }
                })
            },
            orderBy: {
                order: "asc"
            }
        })}
    }

    public async getHeadFor(line: Line | LineProxy): Promise<Version> {

        const head = await prismaClient.version.findFirst({
            where: {
                lineId:    line.id,
                timestamp: { lte: this.timestamp }
            },
            orderBy: {
                timestamp: "desc"
            }
        })

        if (head) {
            return head
        } else {
            return await prismaClient.version.findFirstOrThrow({
                where: {
                    line: {
                        fileId: this.file.id,
                        blocks: { some: { id: this.id } }
                    }
                },
                orderBy: {
                    timestamp: "asc"
                }
            })
        }
    }

    public getHeadsWithLines(): Promise<{ prismaPromise: PrismaPromise<(Version & { line: Line })[]> }> {
        return this.getHeads(true) as Promise<{ prismaPromise: PrismaPromise<(Version & { line: Line })[]> }>
    }

    public getLastImportedVersion() {
        return prismaClient.version.findFirst({
            where: {
                line: {
                    fileId: this.file.id,
                    blocks: { some: { id: this.id } }
                },
                type: VersionType.IMPORTED
            },
            orderBy: {
                timestamp: "desc"
            }
        })
    }

    public async getCurrentVersion(): Promise<{ prismaPromise: PrismaPromise<Version> }> {

        const potentiallyActiveHeads = await prismaClient.version.groupBy({
            by: ["lineId"],
            where: {
                line: {
                    fileId: this.file.id,
                    blocks: { some: { id: this.id } }
                },
                timestamp: { lte: this.timestamp }
            },
            _max: { timestamp: true }
        })

        return { prismaPromise: prismaClient.version.findFirstOrThrow({
            where: {
                OR: potentiallyActiveHeads.map(({ lineId, _max: maxAggregations }) => {
                    return {
                        lineId,
                        timestamp: maxAggregations.timestamp
                    }
                })
            },
            orderBy: {
                line: { order: "desc" }
            }
        })}
    }

    public getTimelineIndexFor(version: Version) {
        return prismaClient.version.count({
            where: {
                line: {
                    fileId: this.file.id,
                    blocks: { some: { id: this.id } }
                },
                type:      { notIn: [VersionType.IMPORTED, VersionType.CLONE] },
                timestamp: { lt: version.timestamp }
            }
        })
    }

    public async getTimeline(): Promise<Version[]> {
        const lastImportedLine = await this.getLastImportedVersion()

        return await prismaClient.version.findMany({
            where: {
                line: {
                    fileId: this.file.id,
                    blocks: { some: { id: this.id } }
                },
                type:      { not: VersionType.CLONE },
                timestamp: lastImportedLine ? { gte: lastImportedLine.timestamp } : undefined
            },
            orderBy: {
                timestamp: "asc"
            }
        })
    }
    */
    

    public async getText(clonesToConsider?: BlockProxy[]): Promise<string> {
        const activeHeads = this.getActiveHeads(clonesToConsider)
        const content     = activeHeads.map(head => head.content)
        return content.join(this.file.eol)

        /*
        // filtering for active lines here is important!!!
        const lines       = this.getLines()
        const eol         = this.file.eol

        const versions    = await this.getVersionsForText({ clonesToConsider })
        const content     = lines.map(line => {
            const version = versions.get(line.id)!
            return version.isActive ? version.content : undefined
        }).filter(content => content !== undefined)

        return content.join(eol)
        */
    }

    public static async createRootBlock(file: FileProxy, filePath: string): Promise<{ blockId: string, block: BlockProxy }> {
        const versions        = file.lines.flatMap(line => line.versions).sort((versionA, versionB) => versionA.timestamp - versionB.timestamp)
        const latestTimestamp = versions.length > 0 ? versions[versions.length - 1].timestamp : 0

        const blockId = filePath + ":root"
        const block   = await prismaClient.block.create({
            data: {
                blockId:   blockId,
                fileId:    file.id,
                type:      BlockType.ROOT,
                timestamp: latestTimestamp,
                lines:     { connect: file.lines.map(line => { return { id: line.id } }) }
            }
        })

        await prismaClient.version.updateMany({
            where: { id: { in: versions.map(version => version.id) } },
            data:  { sourceBlockId: block.id }
        })

        return { blockId: blockId, block: await BlockProxy.getFor(block) }
    }

    // WARNING: Should technically also copy children, but in this usecase unnecessary
    public async copy(): Promise<BlockProxy> {
        const lines      = this.getLines()
        const cloneCount = this.clones.length

        // Why did I have this before?
        // const latestTimestamp = heads.length > 0 ? heads.sort((versionA, versionB) => versionA.timestamp - versionB.timestamp)[heads.length - 1].timestamp : 0

        const block = await prismaClient.block.create({
            data: {
                blockId:   `${this.blockId}:inline${cloneCount}`,
                fileId:    this.file.id,
                type:      BlockType.CLONE,
                timestamp: this.timestamp,
                originId:  this.id,
                lines:     { connect: lines.map(line => { return { id: line.id } }) }
            }
        })

        const clone = await BlockProxy.getFor(block)
        this.clones.push(clone)
        return clone
    }

    public async inlineCopy(lines: LineProxy[]): Promise<BlockProxy> {
        const childrenCount = this.children.length

        const block = await prismaClient.block.create({
            data: {
                blockId:    `${this.blockId}:inline${childrenCount}`,
                fileId:     this.file.id,
                type:       BlockType.INLINE,
                timestamp:  this.timestamp,
                parentId:   this.id,
                lines:      { connect: lines.map(line => { return { id: line.id } }) }
            }
        })

        const child = await BlockProxy.getFor(block)
        this.children.push(child)
        return child
    }

    private async insertLines(lineContents: string[], options?: { previous?: LineProxy, next?: LineProxy, affectedBlocks?: BlockProxy[] }): Promise<{ line: LineProxy, v0: VersionProxy, v1: VersionProxy }[]> {
        if (lineContents.length === 0) { return [] }
        
        const previous       = options?.previous
        const next           = options?.next
        const affectedBlocks = options?.affectedBlocks

        const lines = await this.file.insertLines(lineContents, { previous, next, sourceBlock: this })

        const firstInsertedLine = lines[0].line
        const lastInsertedLine  = lines[lines.length - 1].line

        const blocks = affectedBlocks !== undefined ? affectedBlocks : [this]
        if (blocks.every(block => block.id !== this.id)) { blocks.push(this) }

        blocks.forEach(block => {

            /*
            console.log()
            console.log(block.blockId + ":")
            console.log(lastInsertedLine.order)
            console.log(block.firstLine.order)
            console.log("------------------")
            */

            if (lastInsertedLine.order < block.firstLine.order) {
                block.firstLine = firstInsertedLine
            } else if (block.lastLine.order < firstInsertedLine.order) {
                block.lastLine = lastInsertedLine
            }
        })

        const table = this.getResponsibilityTable()
        for (const lineInfo of lines) {
            const { line, v0, v1 } = lineInfo
            const responsibleBlock = table.get(line.id)
            const blockVersions    = new Map(blocks.map(block => [block, block.id === responsibleBlock.id ? v1 : v0]))
            await line.addBlocks(blockVersions)
        }

        return lines
    }

    // TODO: TEST!!!
    private async prependLines(lineContents: string[], affectedBlocks?: BlockProxy[]): Promise<{ line: LineProxy, v0: VersionProxy, v1: VersionProxy }[]> {
        //const nextLine     = await prismaClient.line.findFirstOrThrow({ where: { fileId: this.file.id, blocks: { some: { id: this.id } }                                }, orderBy: { order: "asc"  } })
        //const previousLine = await prismaClient.line.findFirst(       { where: { fileId: this.file.id, blocks: { none: { id: this.id } }, order: { lt: nextLine.order } }, orderBy: { order: "desc" } })
        
        const lines     = this.getLines()
        const nextLine  = lines[0]

        const previousFileLines = this.file.lines.filter(line => line.order < nextLine.order)
        const previousLine = previousFileLines.length > 0 ? previousFileLines[previousFileLines.length - 1] : undefined
    

        const insertedLines = await this.insertLines(lineContents, { previous:       previousLine ? previousLine : undefined,
                                                                     next:           nextLine     ? nextLine     : undefined,
                                                                     affectedBlocks })

        return insertedLines
    }

    // TODO: TEST!!!
    private async appendLines(lineContents: string[], affectedBlocks?: BlockProxy[]): Promise<{ line:LineProxy, v0: VersionProxy, v1: VersionProxy }[]> {
        //const previousLine = await prismaClient.line.findFirstOrThrow({ where: { fileId: this.file.id, blocks: { some: { id: this.id } }                                    }, orderBy: { order: "desc" } })
        //const nextLine     = await prismaClient.line.findFirst(       { where: { fileId: this.file.id, blocks: { none: { id: this.id } }, order: { gt: previousLine.order } }, orderBy: { order: "asc"  } })
        
        const lines         = this.getLines()
        const previousLine  = lines[lines.length - 1]

        const nextFileLines = this.file.lines.filter(line => previousLine.order < line.order)
        const nextLine = nextFileLines.length > 0 ? nextFileLines[0] : undefined

        const insertedLines = await this.insertLines(lineContents, { previous:       previousLine ? previousLine : undefined,
                                                                     next:           nextLine     ? nextLine     : undefined,
                                                                     affectedBlocks })

        return insertedLines
    }

    public async insertLinesAt(lineNumber: number, lineContents: string[], affectedBlocks: BlockProxy[]): Promise<LineProxy[]> {
        //this.resetVersionMerging()
        if (lineContents.length === 0) { return [] }

        const activeLines         = this.getActiveLines()
        const lastLineNumber      = activeLines.length
        const newLastLine         = lastLineNumber + 1
        const insertionLineNumber = Math.min(Math.max(lineNumber, 1), newLastLine)

        /*
        const expandedLine     = activeLines[Math.min(adjustedLineNumber - 1, lastLineNumber) - 1]
        const expandedChildren = expandedLine.blocks
        */

        let createdLines: LineProxy[]

        if (insertionLineNumber === 1) {
            const lines    = await this.prependLines(lineContents, affectedBlocks)
            createdLines = lines.map(line => line.line)
        } else if (insertionLineNumber === newLastLine) {
            const lines   = await this.appendLines(lineContents, affectedBlocks)
            createdLines = lines.map(line => line.line)
        } else {
            const previousLine = activeLines[insertionLineNumber - 2]
            const currentLine  = activeLines[insertionLineNumber - 1]

            const lines = await this.insertLines(lineContents, { previous: previousLine, next: currentLine, affectedBlocks })
            createdLines = lines.map(line => line.line)
        }

        /*
        expandedChildren.forEach(child => {
            const snapshotData = child.compressForParent()
            const lineNumber   = createdLine.getLineNumber()
            if (snapshotData._endLine < lineNumber) {
                snapshotData._endLine = lineNumber
                child.updateInParent(snapshotData)
            }
        })
        */

        return createdLines
    }

    public async insertLineAt(lineNumber: number, content: string, affectedBlocks: BlockProxy[]): Promise<LineProxy> {
        const lines = await this.insertLinesAt(lineNumber, [content], affectedBlocks)
        return lines[0]
    }

    public async createChild(range: VCSBlockRange): Promise<BlockProxy | null> {
        const linesInRange = this.getLinesInRange(range)

        const overlappingChild = await prismaClient.block.findFirst({
            where: {
                parentId: this.id,
                lines:    { some: { id: { in: linesInRange.map(line => line.id) } } }
            }
        })

        if (overlappingChild) {
            console.warn("Could not create snapshot due to overlap!")
            return null
        }

        return await this.inlineCopy(linesInRange)
    }

    public async asBlockInfo(fileId: VCSFileId): Promise<VCSBlockInfo> {
        const activeLineCount = this.getActiveLines().length

        if (activeLineCount === 0) { throw new Error("Block has no active lines, and can thus not be positioned in parent!") }

        let   firstLineNumberInParent = 1
        let   lastLineNumberInParent  = activeLineCount

        if (this.parent) {
            const activeLinesInParent         = this.parent.getActiveLines()
            const activeLinesBeforeBlock      = activeLinesInParent.filter(line => line.order < this.firstLine.order)
            const countActiveLinesBeforeBlock = activeLinesBeforeBlock.length

            firstLineNumberInParent = countActiveLinesBeforeBlock + 1
            lastLineNumberInParent  = countActiveLinesBeforeBlock + activeLineCount
        }

        const { timeline, index } = this.getTimelineWithCurrentIndex()

        const blockId = VCSBlockId.createFrom(fileId, this.blockId)
        return new VCSBlockInfo(blockId,
                                this.type,
                                {
                                    startLine: firstLineNumberInParent,
                                    endLine:   lastLineNumberInParent
                                },
                                timeline.length,
                                index,
                                this.tags.map(tag => new VCSTagInfo(VCSTagId.createFrom(blockId, tag.tagId), tag.name, tag.code, false)))
    }

    public async getChildrenInfo(fileId: VCSFileId): Promise<VCSBlockInfo[]> {
        return await Promise.all(this.children.map(block => block.asBlockInfo(fileId)))
    }

    public async applyIndex(targetIndex: number): Promise<void> {
        //this.resetVersionMerging()

        const timeline = this.getTimeline()

        if (targetIndex < 0 || targetIndex >= timeline.length) { throw new Error(`Target index ${targetIndex} out of bounds for timeline of length ${timeline.length}!`) }

        let selectedVersion = timeline[targetIndex] // actually targeted version

        await this.applyTimestamp(selectedVersion.timestamp)
    }

    public async applyTimestamp(timestamp: number): Promise<void> {
        await this.setTimestamp(timestamp)
    }

    public async cloneOutdatedHeads(): Promise<void> {
        const heads        = this.getHeads()
        const headsToClone = heads.filter(head => head.timestamp < head.line.getLatestVersion().timestamp)

        if (headsToClone.length > 0) {

            const cloneTimestamp = TimestampProvider.getTimestamp()

            // this could be done with a createMany instead, but I need the side effect of createNewVersion to make sure the in-memory representation remains consistent
            await Promise.all(headsToClone.map(head => {
                return head.line.createVersion(this, cloneTimestamp, VersionType.CLONE, head.isActive, head.content, head)
            }))
        }
    }

    public async updateLine(lineNumber: number, content: string): Promise<LineProxy> {
        const activeLines = this.getActiveLines()

        const line = activeLines[lineNumber - 1]
        const responsibleChild = this.getChildResponsibleFor(line)

        await line.updateContent(responsibleChild, content)

        //this.setupVersionMerging(line)

        return line
    }

    // responsibility issues
    public async updateLines(fileId: VCSFileId, change: MultiLineChange): Promise<VCSBlockId[]> {
        const eol         = this.file.eol
        const activeHeads = this.getActiveHeads()

        //block.resetVersionMerging()

        const startLine        = activeHeads[change.modifiedRange.startLineNumber - 1].line
        const startLineContent = activeHeads[change.modifiedRange.startLineNumber - 1].content
        //const endLineContent   = activeHeads[change.modifiedRange.endLineNumber   - 1].content

        const insertedBeforeCode = startLineContent.length - startLineContent.trimStart().length + 1 >= change.modifiedRange.startColumn
        //const insertedAfterCode  = change.modifiedRange.endColumn > endLineContent.length

        const hasEol        = change.insertedText.includes(eol)
        const startsWithEol = change.insertedText.startsWith(eol)

        const insertedTextAfterLastEol = change.insertedText.split(eol).pop()
        const endsWithEol              = change.insertedText.endsWith(eol) || (hasEol && insertedTextAfterLastEol.trim().length === 0/* && insertedAfterCode*/) // cannot enable this (technically correct) check because of monaco's annoying tab insertion on newline... -> not a problem until endsWithEol is used under new conditions...

        const insertedAtStartOfStartLine = insertedBeforeCode
        const insertedAtEndOfStartLine   = change.modifiedRange.startColumn > startLineContent.length

        const oneLineModification = change.modifiedRange.startLineNumber === change.modifiedRange.endLineNumber
        const oneLineInsertOnly   = oneLineModification && change.modifiedRange.startColumn === change.modifiedRange.endColumn

        const pushStartLineDown = insertedAtStartOfStartLine && endsWithEol  // start line is not modified and will be below the inserted lines
        const pushStartLineUp   = insertedAtEndOfStartLine && startsWithEol  // start line is not modified and will be above the inserted lines

        const noModifications = oneLineInsertOnly && (pushStartLineUp || pushStartLineDown)
        //const modifyStartLine = !oneLineInsertOnly || (!pushStartLineDown && !pushStartLineUp)

        /*
        console.log("\nPush Down")
        console.log(`Inserted Text: "${change.insertedText.trimEnd()}"`)
        console.log(startsWithEol)
        console.log(endsWithEol)
        console.log(startLineContent.length - startLineContent.trimStart().length + 1)
        console.log(change.modifiedRange.startColumn)
        console.log(pushStartLineDown)
        */

        const modifiedRange = {
            startLine: change.modifiedRange.startLineNumber,
            endLine:   change.modifiedRange.endLineNumber
        }

        const modifiedLines = change.lineText.split(eol)
        if (pushStartLineUp) {
            modifiedLines.splice(0, 1)
            modifiedRange.startLine++
        } else if (pushStartLineDown) {
            modifiedLines.pop()
            modifiedRange.endLine--
        }
        
        let vcsLines: LineProxy[] = []
        if (!noModifications) {
            const activeLines = activeHeads.map(head => head.line)
            vcsLines = activeLines.filter((_, index) => modifiedRange.startLine <= index + 1 && index + 1 <= modifiedRange.endLine)
        }

        const block = this
        const table = this.getResponsibilityTable()

        const affectedLines:    LineProxy[]          = []
        // const prismaOperations: PrismaPromise<any>[] = [] // -> unfortunately, side effects are required when creating versions which prevents me from accessing the PrismaPromises
        let   latestTimestamp:  number               = block.timestamp

        async function deleteLine(line: LineProxy): Promise<void> {
            affectedLines.push(line)
            latestTimestamp = TimestampProvider.getTimestamp()
            const responsibleBlock = table.get(line.id)!
            await line.createNextVersion(responsibleBlock, false, "", latestTimestamp)
        }

        async function updateLine(line: LineProxy, content: string): Promise<void> {
            affectedLines.push(line)
            latestTimestamp = TimestampProvider.getTimestamp()
            const responsibleBlock = table.get(line.id)!
            await line.createNextVersion(responsibleBlock, true, content, latestTimestamp)
        }
        
        for (let i = vcsLines.length - 1; i >= modifiedLines.length; i--) {
            const line = vcsLines.at(i)
            await deleteLine(line)
        }

        for (let i = 0; i < Math.min(vcsLines.length, modifiedLines.length); i++) {
            const line = vcsLines.at(i)
            await updateLine(line, modifiedLines[i])
        }

        const linesToInsert = modifiedLines.filter((_, index) => index + 1 > vcsLines.length)
        const insertedLines = await this.insertLinesAt(modifiedRange.startLine + vcsLines.length, linesToInsert, startLine.blocks)
        affectedLines.push(...insertedLines)

        const affectedBlocks = new Set<string>()
        for (const line of affectedLines) {
            const blockIds = await line.getBlockIds()
            blockIds.forEach(id => affectedBlocks.add(id))
        }

        return Array.from(affectedBlocks).map(id => VCSBlockId.createFrom(fileId, id))
    }
}