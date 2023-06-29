import { DatabaseProxy } from "../database-proxy"
import { LineType, BlockProxy, LineProxy, VersionProxy } from "../../types"
import { randomUUID } from "crypto"
import { Prisma, VersionType } from "@prisma/client"

export class FileProxy extends DatabaseProxy {

    public static async create(filePath: string | undefined, eol: string, content: string | undefined): Promise<{ file: FileProxy, rootBlock: BlockProxy }> {
        
        filePath = filePath ? filePath : "TemporaryFile-" +  randomUUID()
        content  = content  ? content  : ""
        
        const lineContents = content.split(eol)

        const file = await this.client.file.create({
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

        await this.client.version.createMany({
            data: lineContents.map((content, index) => {
                const versionType = index === lineContents.length - 1 ? VersionType.LAST_IMPORTED : VersionType.IMPORTED
                return { lineId: file.lines[index].id, type: versionType, timestamp: timestamp++, isActive: true, content }
            }),
        })

        const lines = await this.client.line.findMany({
            where:   { fileId: file.id },
            include: { versions: true },
            orderBy: { order: "asc" }
        })

        const fileProxy = new FileProxy(file.id)
        const headInfo  = new Map<LineProxy, VersionProxy>(lines.map(line => [new LineProxy(line.id, fileProxy), new VersionProxy(line.versions[0].id)]))
        const block     = await BlockProxy.create(filePath + ":root", fileProxy, { headInfo })

        const versions = lines.flatMap(line => line.versions)
        await this.client.version.updateMany({
            where: { id: { in: versions.map(version => version.id) } },
            data:  { sourceBlockId: block.id }
        })

        return { file: fileProxy, rootBlock: block }
    }

    private async normalizeLineOrder(insertPosition?: LineProxy): Promise<number | null> {
        const lines = await this.client.line.findMany({
            where:   { fileId: this.id },
            orderBy: { order: "asc" },
            select:  { id: true }
        })

        let insertionIndex: number | null = null
        const updates = lines.map((line, index) => {
            if (insertPosition !== undefined && line.id === insertPosition.id) { insertionIndex = index }
            return this.client.line.update({
                where: { id: line.id },
                data:  { order: insertionIndex ? index + 2 : index + 1 },
            });
        });

        await this.client.$transaction(updates)

        return insertionIndex ? insertionIndex + 1 : null
    }

    public readonly getFile = () => this.client.file.findUniqueOrThrow({ where: { id: this.id } })

    public async insertLine(content: string, relations?: { previous?: LineProxy, next?: LineProxy, sourceBlock?: BlockProxy }): Promise<{ line:LineProxy, v0: VersionProxy, v1: VersionProxy }> {
        const previous = relations?.previous
        const next     = relations?.next

        let order: number
        if (previous && next) {
            const lines        = await this.client.line.findMany({ where: { id: { in: [previous.id, next.id] } }, select: { id: true, order: true } })
            const previousLine = lines.find(line => line.id === previous.id)!
            const nextLine     = lines.find(line => line.id === next.id)!
            order = (previousLine.order + nextLine.order) / 2
            if (order === previousLine.order || order === nextLine.order) { order = (await this.normalizeLineOrder(next))! }
        } else if (previous) { 
            const previousLine = await this.client.line.findUniqueOrThrow({ where: { id: previous.id }, select: { order: true } })
            order = previousLine.order + 1
        } else if (next) {
            const nextLine = await this.client.line.findUniqueOrThrow({ where: { id: next.id }, select: { order: true } })
            order = nextLine.order / 2
            if (order === nextLine.order) { order = (await this.normalizeLineOrder(next))! }
        } else {
            order = 1
        }

        const versionData: Prisma.Enumerable<Prisma.VersionCreateManyLineInput> = [
            { timestamp: timestamp++, type: VersionType.PRE_INSERTION, isActive: false, content: "" },
            { timestamp: timestamp++, type: VersionType.INSERTION,     isActive: false, content     }
        ]

        if (relations?.sourceBlock) { versionData.forEach(version => version.sourceBlockId = relations.sourceBlock.id) }

        const line = await this.client.line.create({
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
        const firstLine = await this.client.line.findFirst({ where: { fileId: this.id }, orderBy: { order: "asc" }, select: { id: true } })
        return await this.insertLine(content, { next: firstLine ? new LineProxy(firstLine.id, this) : undefined })
    }

    public async appendLine(content: string): Promise<{ line:LineProxy, v0: VersionProxy, v1: VersionProxy }> {
        const lastLine = await this.client.line.findFirst({ where: { fileId: this.id }, orderBy: { order: "desc" }, select: { id: true } })
        return await this.insertLine(content, { previous: lastLine ? new LineProxy(lastLine.id, this) : undefined })
    }
}