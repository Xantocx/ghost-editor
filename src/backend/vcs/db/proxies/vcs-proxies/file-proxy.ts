import { DatabaseProxy } from "../database-proxy"
import { randomUUID } from "crypto"
import { Prisma, VersionType, LineType } from "@prisma/client"
import { LineProxy, VersionProxy, BlockProxy } from "../../types"
import { prismaClient } from "../../client"
import { TimestampProvider } from "../../../core/metadata/timestamps"

export class FileProxy extends DatabaseProxy {

    public static async create(filePath: string | undefined, eol: string, content: string | undefined): Promise<{ file: { filePath: string, file: FileProxy }, rootBlock: { blockId: string, block: BlockProxy } }> {
        
        filePath = filePath ? filePath : "TemporaryFile-" +  randomUUID()
        content  = content  ? content  : ""
        
        const lineContents = content.split(eol)

        const file = await prismaClient.file.create({
            data: {
                filePath,
                eol,
                lines: {
                    createMany: {
                        data: lineContents.map((_, index) => {
                            return { 
                                order: index + 1,
                                type: LineType.ORIGINAL,
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

        await prismaClient.version.createMany({
            data: lineContents.map((content, index) => {
                return { lineId: file.lines[index].id, type: VersionType.IMPORTED, timestamp: TimestampProvider.getTimestamp(), isActive: true, content }
            }),
        })

        const fileProxy          = new FileProxy(file.id)
        const { blockId, block } = await BlockProxy.createRootBlock(fileProxy, filePath)

        return { file: { filePath, file: fileProxy }, rootBlock: { blockId, block } }
    }

    private async normalizeLineOrder(insertPosition?: LineProxy): Promise<number | null> {
        const lines = await prismaClient.line.findMany({
            where:   { fileId: this.id },
            orderBy: { order: "asc" },
            select:  { id: true }
        })

        let insertionIndex: number | null = null
        const updates = lines.map((line, index) => {
            if (insertPosition !== undefined && line.id === insertPosition.id) { insertionIndex = index }
            return prismaClient.line.update({
                where: { id: line.id },
                data:  { order: insertionIndex ? index + 2 : index + 1 },
            });
        });

        await prismaClient.$transaction(updates)

        return insertionIndex ? insertionIndex + 1 : null
    }

    public readonly getFile = () => prismaClient.file.findUniqueOrThrow({ where: { id: this.id } })

    public async getEol(): Promise<string> {
        const file = await this.getFile()
        return file.eol
    }

    public async insertLine(content: string, relations?: { previous?: LineProxy, next?: LineProxy, sourceBlock?: BlockProxy }): Promise<{ line:LineProxy, v0: VersionProxy, v1: VersionProxy }> {
        const previous = relations?.previous
        const next     = relations?.next

        let order: number
        if (previous && next) {
            const lines        = await prismaClient.line.findMany({ where: { id: { in: [previous.id, next.id] } }, select: { id: true, order: true } })
            const previousLine = lines.find(line => line.id === previous.id)!
            const nextLine     = lines.find(line => line.id === next.id)!
            order = (previousLine.order + nextLine.order) / 2
            if (order === previousLine.order || order === nextLine.order) { order = (await this.normalizeLineOrder(next))! }
        } else if (previous) { 
            const previousLine = await prismaClient.line.findUniqueOrThrow({ where: { id: previous.id }, select: { order: true } })
            order = previousLine.order + 1
        } else if (next) {
            const nextLine = await prismaClient.line.findUniqueOrThrow({ where: { id: next.id }, select: { order: true } })
            order = nextLine.order / 2
            if (order === nextLine.order) { order = (await this.normalizeLineOrder(next))! }
        } else {
            order = 1
        }

        const versionData: Prisma.Enumerable<Prisma.VersionCreateManyLineInput> = [
            { timestamp: TimestampProvider.getTimestamp(), type: VersionType.PRE_INSERTION, isActive: false, content: "" },
            { timestamp: TimestampProvider.getTimestamp(), type: VersionType.INSERTION,     isActive: true,  content     }
        ]

        if (relations?.sourceBlock) { versionData.forEach(version => version.sourceBlockId = relations.sourceBlock!.id) }

        const line = await prismaClient.line.create({
            data: {
                fileId: this.id,
                order:  order,
                type:   LineType.INSERTED,
                versions: {
                    createMany: {
                        data: versionData
                    }
                }
            },
            include: {
                versions: {
                    orderBy: { timestamp: "asc" }
                }
            }
        })

        return { line: new LineProxy(line.id, this), v0: new VersionProxy(line.versions[0].id), v1: new VersionProxy(line.versions[1].id) }
    }

    public async prependLine(content: string): Promise<{ line:LineProxy, v0: VersionProxy, v1: VersionProxy }> {
        const firstLine = await prismaClient.line.findFirst({ where: { fileId: this.id }, orderBy: { order: "asc" }, select: { id: true } })
        return await this.insertLine(content, { next: firstLine ? new LineProxy(firstLine.id, this) : undefined })
    }

    public async appendLine(content: string): Promise<{ line:LineProxy, v0: VersionProxy, v1: VersionProxy }> {
        const lastLine = await prismaClient.line.findFirst({ where: { fileId: this.id }, orderBy: { order: "desc" }, select: { id: true } })
        return await this.insertLine(content, { previous: lastLine ? new LineProxy(lastLine.id, this) : undefined })
    }
}