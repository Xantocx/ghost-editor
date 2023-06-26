import { Prisma, PrismaClient, LineType, Line } from '@prisma/client'

export const prisma = new PrismaClient()

let timestamp = Math.floor(Math.random() * 10000000)

abstract class DatabaseProxy {
    
    public readonly id: number

    public constructor(id: number) {
        this.id = id
    }
}

export class VersionProxy extends DatabaseProxy {}

export class LineProxy extends DatabaseProxy {

    public async addBlock(block: BlockProxy, headVersion: VersionProxy): Promise<void> {
        await prisma.line.update({
            where: { id: this.id },
            data:  { 
                blocks: { connect: { id: block.id } },
                heads: {
                    create: {
                        block:   { connect: { id: block.id } },
                        version: { connect: { id: headVersion.id } }
                    }
                }
            }
        })

        /*
        const head = await prisma.head.findFirst({ where: { blockId: block.id, lineId: this.id } })
        return head!
        */
    }

    public async addBlocks(headInfo: Map<BlockProxy, VersionProxy>): Promise<void> {
        const blocks = Array.from(headInfo.keys())

        await prisma.line.update({
            where: { id: this.id },
            data:  { blocks: { connect: blocks.map(block => { return { id: block.id } }) } }
        })

        await prisma.head.createMany({
            data: blocks.map(block => {
                return {
                    blockId:   block.id,
                    lineId:    this.id,
                    versionId: headInfo.get(block)!.id
                }
            })
        })

        /*
        const heads = await prisma.head.findMany({ 
            where: { 
                blockId: { in: blocks.map(blocks => blocks.id) },
                lineId:  this.id
            }
        })

        return heads.map(head => new HeadProxy(head.id))
        */
    }
}

export class HeadProxy extends DatabaseProxy {}

export class BlockProxy extends DatabaseProxy {

    public static async create(blockId: string, file: FileProxy, relations?: { headInfo: Map<LineProxy, VersionProxy>, parent?: BlockProxy, origin?: BlockProxy }): Promise<BlockProxy> {
        const blockData: Prisma.BlockCreateInput = {
            blockId,
            file: { connect: { id: file.id } }
        }

        if (relations?.headInfo) {
            const headInfo  = relations.headInfo
            const lines     = Array.from(headInfo.keys())
            blockData.lines = { connect: lines.map(line => { return { id: line.id } }) }
            blockData.heads = {
                createMany: {
                    data: lines.map(line => {
                        return {
                            lineId:    line.id,
                            versionId: headInfo.get(line)!.id
                        } 
                    })
                }
            }
        }

        if (relations?.parent)   { blockData.parent = { connect: { id: relations.parent.id } } }
        if (relations?.origin)   { blockData.origin = { connect: { id: relations.origin.id } } }

        const block = await prisma.block.create({ data: blockData })

        return new BlockProxy(block.id)
    }
}

export class FileProxy extends DatabaseProxy {

    public static async create(filePath: string | undefined, eol: string, content?: string): Promise<FileProxy> {
        content = content ? content : ""
        const lineContents = content.split(eol)

        const file = await prisma.file.create({
            data: {
                filePath,
                eol,
                lines: {
                    createMany: {
                        data: lineContents.map((_, index) => {
                            return { 
                                order: index + 1,
                                lineType: LineType.ORIGINAL,
                            }
                        })
                    }
                }
            },
            include: {
                lines: {
                    orderBy: {
                        order: "asc"
                    }
                }
            }
        })

        await prisma.version.createMany({
            data: lineContents.flatMap((content, index) => {
                return [
                    { lineId: file.lines[index].id, timestamp: timestamp++, isActive: false, content: "" },
                    { lineId: file.lines[index].id, timestamp: timestamp++, isActive: true, content }
                ]
            }),
        })

        const lines = await prisma.line.findMany({
            where: {
                file: {
                    id: file.id
                }
            },
            include: {
                versions: {
                    orderBy: {
                        timestamp: "asc"
                    }
                }
            },
            orderBy: {
                order: "asc"
            }
        })

        const fileProxy = new FileProxy(file.id)
        const headInfo  = new Map<LineProxy, VersionProxy>(lines.map(line => [new LineProxy(line.id), line.versions[1]]))
        const block     = await BlockProxy.create("ROOT BLOCK " + Math.floor(Math.random() * 1000000), fileProxy, { headInfo })

        const versions = lines.flatMap(line => line.versions)
        await prisma.version.updateMany({
            where: { id: { in: versions.map(version => version.id) } },
            data:  { sourceBlockId: block.id }
        })

        return fileProxy
    }

    private async normalizeLineOrder(insertPosition?: LineProxy): Promise<number | null> {
        const lines = await prisma.line.findMany({
            where:   { fileId: this.id },
            orderBy: { order: "asc" },
            select:  { id: true }
        })

        let insertionIndex: number | null = null
        const updates = lines.map((line, index) => {
            if (insertPosition !== undefined && line.id === insertPosition.id) { insertionIndex = index }
            return prisma.line.update({
                where: { id: line.id },
                data:  { order: insertionIndex ? index + 2 : index + 1 },
            });
        });

        await prisma.$transaction(updates)

        return insertionIndex ? insertionIndex + 1 : null
    }

    public async insertLine(content: string, location?: { previous?: LineProxy, next?: LineProxy }): Promise<LineProxy> {
        const previous = location?.previous
        const next     = location?.next

        let order: number
        if (previous && next) {
            const lines        = await prisma.line.findMany( { where: { id: { in: [previous.id, next.id] } }, select: { id: true, order: true } })
            const previousLine = lines.find(line => line.id === previous.id)!
            const nextLine     = lines.find(line => line.id === next.id)!
            order = (previousLine.order + nextLine.order) / 2
            if (order === previousLine.order || order === nextLine.order) { order = (await this.normalizeLineOrder(next))! }
        } else if (previous) { 
            const previousLine = (await prisma.line.findFirst({ where: { id: previous.id }, select: { order: true } }))!
            order = previousLine.order + 1
        } else if (next) {
            const nextLine = (await prisma.line.findFirst({ where: { id: next.id }, select: { id: true, order: true } }))!
            order = nextLine.order / 2
            if (order === nextLine.order) { order = (await this.normalizeLineOrder(next))! }
        } else {
            order = 1
        }

        const line = await prisma.line.create({
            data: {
                file: { connect: { id: this.id } },
                order: order,
                lineType: LineType.INSERTED,
                versions: {
                    createMany: {
                        data: [
                            { timestamp: timestamp++, isActive: false, content: "" },
                            { timestamp: timestamp++, isActive: false, content }
                        ]
                    }
                }
            }
        })

        return new LineProxy(line.id)
    }

    public async prependLine(content: string): Promise<LineProxy> {
        const firstLine = await prisma.line.findFirst({ where: { fileId: this.id }, orderBy: { order: "asc" }, select: { id: true } })
        return await this.insertLine(content, { next: firstLine ? new LineProxy(firstLine.id) : undefined })
    }

    public async appendLine(content: string): Promise<LineProxy> {
        const lastLine = await prisma.line.findFirst({ where: { fileId: this.id }, orderBy: { order: "desc" }, select: { id: true } })
        return await this.insertLine(content, { previous: lastLine ? new LineProxy(lastLine.id) : undefined })
    }
}