import { Prisma, BlockType, Block, VersionType, Version, Line } from "@prisma/client"
import { FileDatabaseProxy } from "../database-proxy"
import { prismaClient } from "../../client"
import { FileProxy, LineProxy, VersionProxy } from "../../types"
import { BlockId, BlockInfo, BlockRange, FileId, TagId, TagInfo } from "../../../../../app/components/vcs/vcs-rework"

export class BlockProxy extends FileDatabaseProxy {

    public readonly getBlock         = () => prismaClient.block.findUniqueOrThrow({ where: { id: this.id } })
    public readonly getCloneCount    = () => prismaClient.block.count({ where: { originId: this.id } })
    public readonly getChildrenCount = () => prismaClient.block.count({ where: { parentId: this.id } })
    public readonly getLineCount     = () => prismaClient.line.count({ where: { blocks: { some: { id: this.id } } } })
    public readonly getVersionCount  = () => prismaClient.version.count({ where: { line: { blocks: { some: { id: this.id } } } } })
    public readonly getChildren      = () => prismaClient.block.findMany({ where: { parentId: this.id } })
    public readonly getLines         = () => prismaClient.line.findMany({ where: { blocks: { some: { id: this.id } } } })
    public readonly getHeadList      = () => prismaClient.headList.findFirstOrThrow({ where: { blocks: { some: { id: this.id } } } })
    //public readonly getAllVersions = () => prismaClient.version.findMany({ where: { line: { blocks: { some: { id: this.id } } } }, orderBy: { line: { order: "asc" } } })
    public readonly getTags          = () => prismaClient.tag.findMany({ where: { blockId: this.id }, include: { block: { select: { blockId: true } } } })

    public readonly getOriginalLineCount = () => prismaClient.version.count({
        where: {
            line: { blocks: { some: { id: this.id } } },
            type: { in: [VersionType.IMPORTED, VersionType.LAST_IMPORTED] }
        }
    })

    public readonly getActiveLineCount = () => prismaClient.version.count({
        where: {
            line: {
                blocks: { some: { id: this.id } }
            },
            headLists: {
                some: {
                    blocks: { some: { id: this.id } }
                }
            },
            isActive: true
        }
    })

    public readonly getActiveLines = () => prismaClient.line.findMany({
        where: {
            fileId:   this.file.id,
            blocks:   { some: { id: this.id } },
            versions: {
                some: {
                    headLists: { some: { blocks: { some: { id: this.id } } } },
                    isActive:  true
                }
            }
        },
        orderBy: {
            order: "asc"
        }
    })

    public readonly getHeadVersions = () => prismaClient.version.findMany({
        where: {
            line: {
                blocks: { some: { id: this.id } }
            },
            headLists: {
                some: {
                    blocks: { some: { id: this.id } }
                }
            }
        },
        orderBy: {
            line: { order: "asc" }
        }
    })

    public readonly getActiveHeadVersions = () => prismaClient.version.findMany({
        where: {
            line: {
                blocks: { some: { id: this.id } }
            },
            headLists: {
                some: {
                    blocks: { some: { id: this.id } }
                }
            },
            isActive: true
        },
        orderBy: {
            line: { order: "asc" }
        }
    })

    public readonly getHeadFor = (line: LineProxy | Line) => prismaClient.version.findFirst({
        where: {
            lineId:    line.id,
            headLists: {
                some: {
                    blocks: { some: { id: this.id } }
                }
            }
        }
    })

    public readonly getHeadsWithLines = () => prismaClient.version.findMany({
        where: {
            line: {
                blocks: { some: { id: this.id } }
            },
            headLists: {
                some: {
                    blocks: { some: { id: this.id } }
                }
            }
        },
        orderBy: {
            line: { order: "asc" }
        },
        include: {
            line: true
        }
    })

    public readonly getTimeline = () => prismaClient.version.findMany({
        where: {
            line: {
                fileId: this.file.id,
                blocks: { some: { id: this.id } }
            },
            type: { notIn: [VersionType.IMPORTED] }
        },
        orderBy: {
            timestamp: "asc"
        }
    })

    public readonly getCurrentVersion = () => prismaClient.version.findFirstOrThrow({
        where: {
            line:      { fileId: this.file.id },
            headLists: { some: { blocks: { some: { id: this.id } } } },
            type:      { notIn: [VersionType.IMPORTED] }
        },
        orderBy: { timestamp: "desc" }
    })

    public getTimelineIndexFor = (version: Version) => prismaClient.version.count({
        where: {
            line: {
                fileId: this.file.id,
                blocks: { some: { id: this.id } }
            },
            type:      { notIn: [VersionType.IMPORTED] },
            timestamp: { lt: version.timestamp }
        }
    })

    public async getText(): Promise<string> {
        const [file, versions] = await prismaClient.$transaction([
            this.file.getFile(),
            this.getHeadVersions()
        ])

        const content = versions.map(version => version.content)
        return content.join(file.eol)
    }

    public async getFullText(accumulation?: { blockText: string, selectedVersions: Map<number, Version> }): Promise<{ blockText: string, fullText: string }> {
        const block = await this.getBlock()

        type Accumulation = { blockText: string, selectedVersions: Map<number, Version> }
        async function accumulate(fileProxy: FileProxy, versions: Version[], acc?: Accumulation): Promise<Accumulation> {
            if (acc) {
                acc.selectedVersions = new Map(versions.map(version => [version.lineId, acc.selectedVersions.has(version.lineId) ? acc.selectedVersions.get(version.lineId)! : version]))
                return acc
            } else {
                const file             = await fileProxy.getFile()
                const lineContent      = versions.map(version => version.content)
                const text             = lineContent.join(file.eol)
                const selectedVersions = new Map(versions.map(version => [version.lineId, version]))
                return { blockText: text, selectedVersions: selectedVersions }
            }
        }

        if (block.type === BlockType.ROOT) {

            const [file, rootVersions] = await prismaClient.$transaction([
                this.file.getFile(),
                this.getHeadVersions()
            ])

            if (accumulation) {
                const selectedVersions = accumulation.selectedVersions
                const content          = rootVersions.map(version => selectedVersions.has(version.lineId) ? selectedVersions.get(version.lineId)!.content : version.content)
                return { blockText: accumulation.blockText, fullText: content.join(file.eol) }
            } else {
                const lineContent = rootVersions.map(version => version.content)
                const text        = lineContent.join(file.eol)
                return { blockText: text, fullText: text }
            }

        } else if (block.type === BlockType.CLONE) {

            const origin        = new BlockProxy(block.originId!, this.file)
            const blockVersions = await this.getHeadVersions()
            return await origin.getFullText(await accumulate(this.file, blockVersions, accumulation))

        } else if (block.type === BlockType.INLINE) {

            const parent = new BlockProxy(block.parentId!, this.file)

            if (accumulation) {
                return await parent.getFullText(accumulation)
            } else {
                const blockVersions = await this.getHeadVersions()
                return await parent.getFullText(await accumulate(this.file, blockVersions))
            }
        } else {
            throw new Error("Block type unknown!")
        }
    }

    public async getLinesInRange(range: BlockRange): Promise<LineProxy[]> {
        const versions = await this.getHeadsWithLines()

        const activeVersions = versions.filter(version => version.isActive)

        const firstVersion = activeVersions[range.startLine - 1] 
        const lastVersion  = activeVersions[range.endLine - 1] 

        const versionsInRange = versions.filter(version => firstVersion.line.order <= version.line.order && version.line.order <= lastVersion.line.order)

        return versionsInRange.map(version => LineProxy.createFrom(version.line, this.file))
    }

    public async getActiveLinesInRange(range: BlockRange): Promise<LineProxy[]> {
        const lines        = await this.getActiveLines()
        const linesInRange = lines.filter((line, index) => range.startLine <= index + 1 && index + 1 <= range.endLine)
        return lines.map(line => LineProxy.createFrom(line, this.file))
    }

    public static createFrom(block: Block, file?: FileProxy): BlockProxy {
        file = file ? file : new FileProxy(block.fileId)
        return new BlockProxy(block.id, file)
    }

    public static async createRootBlock(file: FileProxy, filePath: string): Promise<{ blockId: string, block: BlockProxy }> {
        const lines = await prismaClient.line.findMany({
            where:   { fileId: file.id },
            include: { versions: true },
            orderBy: { order: "asc" }
        })

        const versionList = await prismaClient.headList.create({
            data: {
                versions: {
                    connect: lines.map(line => {
                        const versionCount = line.versions.length
                        if (versionCount === 0) { throw new Error("Creation of root block for file requires (a) existing version(s) for each line!") }
                        return { id: line.versions[versionCount - 1].id } 
                    })
                }
            }
        })

        const blockId = filePath + ":root"
        const block   = await prismaClient.block.create({
            data: {
                blockId:       blockId,
                fileId:        file.id,
                type:          BlockType.ROOT,
                lines:         { connect: lines.map(line => { return { id: line.id } }) },
                headListId:    versionList.id,
                ownedHeadList: { connect: { id: versionList.id } }
            }
        })

        const versions = lines.flatMap(line => line.versions)
        await prismaClient.version.updateMany({
            where: { id: { in: versions.map(version => version.id) } },
            data:  { sourceBlockId: block.id }
        })

        return { blockId: blockId, block: BlockProxy.createFrom(block, file) }
    }

    public async copy(): Promise<BlockProxy> {
        const [origin, cloneCount, versions] = await prismaClient.$transaction([
            this.getBlock(),
            this.getCloneCount(),
            this.getHeadVersions()
        ])

        const versionList = await prismaClient.headList.create({
            data: {
                versions: {
                    connect: versions.map(version => { return { id: version.id }  })
                }
            }
        })

        const block = await prismaClient.block.create({
            data: {
                blockId:       `${origin.blockId}:inline${cloneCount}`,
                fileId:        this.file.id,
                type:          BlockType.CLONE,
                originId:      origin.id,
                lines:         { connect: versions.map(version => { return { id: version.lineId } }) },
                headListId:    versionList.id,
                ownedHeadList: { connect: { id: versionList.id } }
            }
        })

        return BlockProxy.createFrom(block, this.file)
    }

    public async inlineCopy(lines: LineProxy[]): Promise<BlockProxy> {
        const [parent, childrenCount] = await prismaClient.$transaction([
            this.getBlock(),
            this.getChildrenCount()
        ])

        const block = await prismaClient.block.create({
            data: {
                blockId:    `${parent.blockId}:inline${childrenCount}`,
                fileId:     parent.fileId,
                type:       BlockType.INLINE,
                parentId:   parent.id,
                lines:      { connect: lines.map(line => { return { id: line.id } }) },
                headListId: parent.headListId
            }
        })

        return BlockProxy.createFrom(block, this.file)
    }

    private async insertLine(content: string, location?: { previous?: LineProxy, next?: LineProxy }): Promise<{ line:LineProxy, v0: VersionProxy, v1: VersionProxy }> {
        const { line, v0, v1 } = await this.file.insertLine(content, { previous: location?.previous, next: location?.next, sourceBlock: this })

        const blockReferenceLine = location?.next ? location.next : location?.previous
        if(blockReferenceLine) {
            const blocks        = await blockReferenceLine.getBlocks()
            const blockVersions = new Map(blocks.map(block => [BlockProxy.createFrom(block, this.file), block.id === this.id ? v1 : v0]))
            await line.addBlocks(blockVersions)
        }

        return { line, v0, v1 }
    }

    // TODO: TEST!!!
    private async prependLine(content: string): Promise<{ line: LineProxy, v0: VersionProxy, v1: VersionProxy }> {
        const nextLine     = await prismaClient.line.findFirstOrThrow({ where: { fileId: this.file.id, blocks: { some: { id: this.id } }                                }, orderBy: { order: "asc"  }, select: { id: true, order: true } })
        const previousLine = await prismaClient.line.findFirst(       { where: { fileId: this.file.id, blocks: { none: { id: this.id } }, order: { lt: nextLine.order } }, orderBy: { order: "desc" }, select: { id: true              } })
        
        return await this.insertLine(content, { previous: previousLine ? new LineProxy(previousLine.id, this.file) : undefined,
                                                next:     nextLine     ? new LineProxy(nextLine.id, this.file)     : undefined })
    }

    // TODO: TEST!!!
    private async appendLine(content: string): Promise<{ line:LineProxy, v0: VersionProxy, v1: VersionProxy }> {
        const previousLine = await prismaClient.line.findFirstOrThrow({ where: { fileId: this.file.id, blocks: { some: { id: this.id } }                                    }, orderBy: { order: "desc" }, select: { id: true, order: true } })
        const nextLine     = await prismaClient.line.findFirst(       { where: { fileId: this.file.id, blocks: { none: { id: this.id } }, order: { gt: previousLine.order } }, orderBy: { order: "asc"  }, select: { id: true              } })
        
        return await this.insertLine(content, { previous: previousLine ? new LineProxy(previousLine.id, this.file) : undefined,
                                                next:     nextLine     ? new LineProxy(nextLine.id, this.file)     : undefined })
    }

    public async insertLineAt(lineNumber: number, content: string): Promise<LineProxy> {
        //this.resetVersionMerging()

        // const activeLines = await this.getActiveLines()

        const lastLineNumber     = await this.getActiveLineCount()
        const newLastLine        = lastLineNumber + 1
        const adjustedLineNumber = Math.min(Math.max(lineNumber, 1), newLastLine)

        /*
        const expandedLine     = activeLines[Math.min(adjustedLineNumber - 1, lastLineNumber) - 1]
        const expandedChildren = expandedLine.blocks
        */

        let createdLine: LineProxy

        if (adjustedLineNumber === 1) {
            const { line, v0, v1 } = await this.prependLine(content) // TODO: could be optimized by getting previous line from file lines
            createdLine = line
        } else if (adjustedLineNumber === newLastLine) {
            const { line, v0, v1 } = await this.appendLine(content) // TODO: could be optimized by getting previous line from file lines
            createdLine = line
        } else {
            const activeLines = await this.getActiveLines()

            const previousLine = activeLines[adjustedLineNumber - 2]
            const currentLine  = activeLines[adjustedLineNumber - 1]

            const previousLineProxy = new LineProxy(previousLine.id, this.file)
            const currentLineProxy  = new LineProxy(currentLine.id, this.file)

            const { line, v0, v1 } = await this.insertLine(content, { previous: previousLineProxy, next: currentLineProxy })
            createdLine = line
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

        return createdLine
    }

    public async createChild(range: BlockRange): Promise<BlockProxy | null> {
        const linesInRange = await this.getLinesInRange(range)

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

        return this.inlineCopy(linesInRange)
    }

    public async asBlockInfo(fileId: FileId): Promise<BlockInfo> {

        const [block, originalLineCount, activeLineCount, versionCount, firstLine, currentVersion, tags] = await prismaClient.$transaction([
            this.getBlock(),
            this.getOriginalLineCount(),
            this.getActiveLineCount(),
            this.getVersionCount(),

            prismaClient.line.findFirstOrThrow({
                where: {
                    fileId: this.file.id,
                    blocks: { some: { id: this.id } } 
                },
                orderBy: { order: "asc"  },
                select: { id: true, order: true }
            }),

            this.getCurrentVersion(),
            this.getTags()
        ])

        if (activeLineCount === 0) { throw new Error("Block has no active lines, and can thus not be positioned in parent!") }

        let   firstLineNumberInParent = 1
        let   lastLineNumberInParent  = activeLineCount
        const userVersionCount        = versionCount - originalLineCount + 1  // one selectable version per version minus pre-insertion versions (one per inserted line) and imported lines (which, together, is the same as all lines) plus one version for the original state of the file

        if (block.parentId) {
            const activeLinesBeforeBlock = await prismaClient.line.count({
                where: {
                    fileId:   this.file.id,
                    blocks:   { none: { id: this.id } },     // line is not part of this block,
                    versions: {                              // but has a head (aka is part of) the parent block
                        some: {
                            headLists: { some: {  blocks: { some: { id: block.parentId } } } },
                            isActive:  true
                        }
                    },
                    order: { lt: firstLine.order },          // only lines before the block
                }
            })
    
            firstLineNumberInParent = activeLinesBeforeBlock + 1
            lastLineNumberInParent  = activeLinesBeforeBlock + activeLineCount
        }

        const currentVersionIndex = await this.getTimelineIndexFor(currentVersion)

        const blockId = BlockId.createFrom(fileId, block.blockId)
        return new BlockInfo(blockId,
                             block.type,
                             {startLine: 1, endLine: 1},
                             userVersionCount,
                             currentVersionIndex,
                             tags.map(tag => new TagInfo(TagId.createFrom(blockId, tag.tagId), tag.name, tag.code, false)))
    }

    public async getChildrenInfo(fileId: FileId): Promise<BlockInfo[]> {
        const children = await this.getChildren()
        const blocks = children.map(child => BlockProxy.createFrom(child, this.file))
        return await Promise.all(blocks.map(block => block.asBlockInfo(fileId)))
    }

    public async updateLine(lineNumber: number, content: string): Promise<LineProxy> {
        const lines = await this.getActiveLines()

        const line = new LineProxy(lines[lineNumber - 1].id, this.file)
        await line.updateContent(content, this)

        //this.setupVersionMerging(line)

        return line
    }

    public async applyIndex(targetIndex: number): Promise<void> {
        //this.resetVersionMerging()

        const timeline = await this.getTimeline()

        if (targetIndex < 0 || targetIndex >= timeline.length) { throw new Error(`Target index ${targetIndex} out of bounds for timeline of length ${timeline.length}!`) }

        let selectedVersion = timeline[targetIndex] // actually targeted version

        await this.applyTimestamp(selectedVersion.timestamp)
    }

    public async applyTimestamp(timestamp: number): Promise<void> {
        const heads = await this.getHeadsWithLines()
        const headList = await this.getHeadList()

        const lines = heads.map(head => head.line)
        
        // latest version for lines before or equal to timestamp
        const versions = await prismaClient.$transaction(lines.map(line => {
            return prismaClient.version.findFirst({
                where: {
                    lineId:    line.id,
                    timestamp: { lte: timestamp }
                },
                orderBy: {
                    timestamp: "desc"
                }
            })
        }))

        // latest tracked version for lines before or equal to timestamp
        const trackedVersions = await prismaClient.$transaction(lines.map(line => {
            return prismaClient.trackedVersion.findFirst({
                where: {
                    lineId:    line.id,
                    timestamp: { lte: timestamp }
                },
                orderBy: { timestamp: "desc" },
                include: { version: true }
            })
        }))

        // update head for each line with whatever has the latest timestamp, the latest version or the latest tracked version
        const selected = await Promise.all(lines.map(async (line, index) => {
            const version  = versions[index]
            const tracked  = trackedVersions[index]

            let selected: Version
            if (version) {
                if (tracked) {
                    selected = version.timestamp >= tracked.timestamp ? version : tracked.version
                } else {
                    selected = version
                }
            } else {
                selected = await prismaClient.version.findFirstOrThrow({
                    where:   { lineId: line.id },
                    orderBy: { timestamp: "asc" }
                })
            }

            return selected
        }))


        await prismaClient.headList.update({
            where: { id: headList.id },
            data:  {
                versions: {
                    connect:    selected.map(version => { return { id: version.id } }),
                    disconnect: heads.map(   head    => { return { id: head.id } })
                }
            }
        })
    }

    /*
    public async addLines(lineVersions: Map<LineProxy, VersionProxy>): Promise<void> {
        const lines = Array.from(lineVersions.keys())

        await prismaClient.head.createMany({
            data: lines.map(line => {
                return {
                    ownerBlockId: this.id,
                    lineId:       line.id,
                    versionId:    lineVersions.get(line)!.id
                } 
            })
        })

        const heads = await prismaClient.head.findMany({ where: { ownerBlockId: this.id } })

        await prismaClient.block.update({
            where: { id: this.id },
            data: {
                lines: { 
                    connect: lines.map(line => {
                        return { id: line.id }
                    }) },
                heads: { 
                    connect: heads.map(head => { 
                        return { id: head.id }
                    })
                }
            }
        })
    }
    */
}