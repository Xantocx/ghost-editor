import { BlockType, Block, VersionType, Version, Line, PrismaPromise, Prisma, LineType, Tag } from "@prisma/client"
import { DatabaseProxy } from "../database-proxy"
import { prismaClient } from "../../client"
import { FileProxy, LineProxy, TagProxy, VersionProxy } from "../../types"
import { VCSBlockId, VCSBlockInfo, VCSBlockRange, VCSFileId, VCSTagId, VCSTagInfo } from "../../../../../app/components/vcs/vcs-rework"
import { TimestampProvider } from "../../../core/metadata/timestamps"
import { MultiLineChange } from "../../../../../app/components/data/change"
import { ProxyCache } from "../proxy-cache"
import { ISessionBlock } from "../../utilities"
import { randomUUID } from "crypto"
import CodeAI from "../../openai-client"


enum BlockReference {
    Previous,
    Next
}

export class BlockProxy extends DatabaseProxy implements ISessionBlock<FileProxy, BlockProxy, LineProxy, TagProxy> {

    public ai: CodeAI

    public readonly blockId: string
    public readonly type:    BlockType

    public file: FileProxy

    public firstLine: LineProxy
    public lastLine:  LineProxy

    public parent?: BlockProxy
    public origin?: BlockProxy

    public children: BlockProxy[] = []
    public clones:   BlockProxy[] = []
    public tags:     TagProxy[]   = []

    public representedTag?: TagProxy

    private _timestamp:  number
    public get timestamp(): number{ return this._timestamp }

    public async setTimestampManually(newTimestamp: number): Promise<void> {
        this._timestamp = newTimestamp
        await this.representedTag?.setTimestamp(this.timestamp)
    }

    public async setTimestamp(newTimestamp: number): Promise<void> {
        const updatedBlock = await prismaClient.block.update({
            where: { id: this.id },
            data:  { timestamp: newTimestamp }
        })

        this._timestamp = updatedBlock.timestamp
        await this.representedTag?.setTimestamp(this.timestamp)
    }

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
        const proxy = new BlockProxy(block.id, block.blockId, block.type, block.timestamp)

        ProxyCache.registerBlockProxy(proxy)

        proxy.file = await ProxyCache.getFileProxy(block.fileId)

        // TODO: Blocks without lines are not handled well like this...
        const firstLineData  = await prismaClient.line.findFirst({ where: { fileId: proxy.file.id, blocks: { some: { id: block.id } } }, orderBy: { order: "asc" } })!
        const lastLineData   = await prismaClient.line.findFirst({ where: { fileId: proxy.file.id, blocks: { some: { id: block.id } } }, orderBy: { order: "desc" } })!
        const childrenData   = await prismaClient.block.findMany({ where: { fileId: proxy.file.id, parentId: block.id } })
        const cloneData      = await prismaClient.block.findMany({ where: { fileId: proxy.file.id, originId: block.id } })
        const tagData        = await prismaClient.tag.findMany({   where: { sourceBlockId: block.id } })
        const representedTag = await prismaClient.tag.findUnique({ where: { tagBlockId: block.id } })

        proxy.parent = block.parentId ? await ProxyCache.getBlockProxy(block.parentId) : undefined
        proxy.origin = block.originId ? await ProxyCache.getBlockProxy(block.originId) : undefined

        proxy.firstLine = await LineProxy.getFor(firstLineData)
        proxy.lastLine  = await LineProxy.getFor(lastLineData)

        for (const child of childrenData) { proxy.children.push(await BlockProxy.getFor(child)) }
        for (const clone of cloneData)    { proxy.clones.push(  await BlockProxy.getFor(clone)) }
        for (const tag of tagData)        { proxy.tags.push(    await TagProxy.getFor(tag)) }

        proxy.representedTag = representedTag ? await TagProxy.getFor(representedTag) : undefined

        // NOTES: this is a unique call that is only relevant when a new block is created on already existing/loaded lines -> in this case, this will notify the lines about new blocks
        proxy.getLines().forEach(line => {
            if (!line.blocks.some(block => block.id === proxy.id)) {
                line.blocks.push(proxy)
            }
        })

        // has to be here as parent is required
        proxy.ai = await CodeAI.create(proxy, block)

        return proxy
    }

    private constructor(id: number, blockId: string, type: BlockType, timestamp: number) {
        super(id)
        this.blockId    = blockId
        this.type       = type
        this._timestamp = timestamp
    }

    public async getFileRoot(): Promise<BlockProxy> {
        let root = await this.getRoot()
        while (root.origin !== undefined) { root = await root.origin!.getRoot() }
        return root
    }

    // for a cloned block, the clone is the root
    public async getRoot(): Promise<BlockProxy> {
        let root = this as BlockProxy
        while (root.parent !== undefined) { root = root.parent }
        return root
    }

    private getResponsibilityTable(accumulation?: { clonesToConsider?: BlockProxy[], collectedTimestamps?: Map<number, BlockProxy> }): Map<number, BlockProxy> {
        const clonesToConsider    = accumulation?.clonesToConsider
        const collectedTimestamps = accumulation?.collectedTimestamps

        if (clonesToConsider) {
            const cloneIndex = clonesToConsider.findIndex(clone => clone.origin?.id === this.id)
            if (cloneIndex > -1) {
                const clone = clonesToConsider.splice(cloneIndex, 1)[0]
                return clone.getResponsibilityTable(accumulation)
            }
        }

        const lines      = this.getLines()
        let   timestamps = collectedTimestamps !== undefined ? collectedTimestamps : new Map<number, BlockProxy>()

        lines.forEach(line => timestamps.set(line.id, this))

        for (const child of this.children) {
            timestamps = child.getResponsibilityTable({ clonesToConsider, collectedTimestamps: timestamps })
        }

        return timestamps
    }

    public getChildResponsibleFor(line: LineProxy, clonesToConsider?: BlockProxy[]): BlockProxy {
        const table = this.getResponsibilityTable({ clonesToConsider })
        return table.get(line.id)!
    }

    public isResponsibleFor(line: LineProxy, clonesToConsider?: BlockProxy[]): boolean {
        const responsibleChild = this.getChildResponsibleFor(line, clonesToConsider)
        return this.id === responsibleChild.id
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

    public getActiveLines(clonesToConsider?: BlockProxy[]): LineProxy[] {
        return this.getActiveHeads(clonesToConsider).map(head => head.line)
    }

    public getActiveLinesInRange(range: VCSBlockRange): LineProxy[] {
        const lines = this.getActiveLines()
        return lines.filter((_, index) => range.startLine <= index + 1 && index + 1 <= range.endLine)
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
        let versions = this.getLines()
            .flatMap(head => head.versions.filter(version => version.type !== VersionType.IMPORTED))
            .sort((versionA, versionB) => versionA.timestamp - versionB.timestamp)

        const lastImportedVersion = this.getLastImportedVersion()
        if (lastImportedVersion) {
            versions.splice(0, 0, lastImportedVersion)
        }

        // NOTE: used to filter clones to avoid multiple clone triggers with the same timestamp
        const timeline: VersionProxy[] = []
        let   lastTimestamp: number | undefined = undefined
        for (let version of versions) {
            if (version.timestamp !== lastTimestamp) {
                timeline.push(version);
                lastTimestamp = version.timestamp;
            }
        }

        return timeline
    }

    private getTimelineWithCurrentIndex(): { timeline: VersionProxy[], index: number } {
        const timeline = this.getTimeline()

        for (let index = timeline.length - 1; index >= 0; index--) {
            const version = timeline[index]
            if (version.timestamp <= this.timestamp) { return { timeline, index } }
        }

        throw new Error("Current timestamp of this block is lower than every single timestamp of a version in the timeline. As a consequence, there is no valid index!")
    }
    
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

    // WARNING: Should technically also copy children, but in this application unnecessary
    public async copy(): Promise<BlockProxy> {
        const lines = this.getLines()

        // Why did I have this before?
        // const latestTimestamp = heads.length > 0 ? heads.sort((versionA, versionB) => versionA.timestamp - versionB.timestamp)[heads.length - 1].timestamp : 0

        const block = await prismaClient.block.create({
            data: {
                blockId:   `${this.blockId}:clone-${randomUUID()}`,
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
        const block = await prismaClient.block.create({
            data: {
                blockId:    `${this.blockId}:inline-${randomUUID()}`,
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
            await line.addBlocks(this, blockVersions)
        }

        return lines
    }

    // TODO: TEST!!!
    private async prependLines(lineContents: string[], affectedBlocks?: BlockProxy[]): Promise<{ line: LineProxy, v0: VersionProxy, v1: VersionProxy }[]> {
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

        const table = this.getResponsibilityTable()
        const overlappingChildren = linesInRange.map(line => table.get(line.id)!) 

        if (overlappingChildren.some(child => child.id !== this.id)) {
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

        const tagInfo: VCSTagInfo[] = [] 
        for (const tag of this.tags) { tagInfo.push(await tag.asTagInfo(blockId)) }

        return new VCSBlockInfo(blockId,
                                this.type,
                                {
                                    startLine: firstLineNumberInParent,
                                    endLine:   lastLineNumberInParent
                                },
                                timeline.length,
                                index,
                                tagInfo)
    }

    public async getChildrenInfo(fileId: VCSFileId): Promise<VCSBlockInfo[]> {
        const info: VCSBlockInfo[] = []
        for (const child of this.children) { info.push(await child.asBlockInfo(fileId)) }
        return info
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
        const headsToClone = heads.filter(head => {
            const latestVersion = head.line.getLatestVersion()

            // the second part of this condition makes sure that we do not clone versions without need if there is already an identical version at the end of this line history
            return head.timestamp < latestVersion.timestamp && (head.content !== latestVersion.content || head.isActive !== latestVersion.isActive)
        })

        if (headsToClone.length > 0) {

            const cloneTimestamp = TimestampProvider.getTimestamp()

            // this could be done with a createMany instead, but I need the side effect of createNewVersion to make sure the in-memory representation remains consistent
            for (const head of headsToClone) {
                await head.line.createVersion(this, cloneTimestamp, VersionType.CLONE, head.isActive, head.content, head)
            }
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

    public async createTag(options?: { name?: string, description?: string, codeForAi?: string }): Promise<TagProxy> {
        const code = await this.getText()

        let name        = options?.name
        let description = options?.description
        let codeForAi   = options?.codeForAi ? options.codeForAi : code

        if (name === undefined || description === undefined) {
            const { name: generatedName, description: generatedDescription } = await this.ai.generateVersionInfo(codeForAi)
            if (name        === undefined) { name        = generatedName }
            if (description === undefined) { description = generatedDescription }
        }

        const tagBlock = await this.copy()

        const tagData = await prismaClient.tag.create({
            data: {
                tagId:         `${this.blockId}:tag-${randomUUID()}`,
                tagBlockId:    tagBlock.id,
                sourceBlockId: this.id,
                name,
                timestamp:     this.timestamp,
                code,
                description
            }
        })

        const tag = await TagProxy.getFor(tagData)
        this.tags.push(tag)
        return tag
    }
}