import { DatabaseProxy } from "../database-proxy"
import { randomUUID } from "crypto"
import { Prisma, VersionType, LineType, Version, File } from "@prisma/client"
import { LineProxy, VersionProxy, BlockProxy } from "../../types"
import { prismaClient } from "../../client"
import { TimestampProvider } from "../../../core/metadata/timestamps"
import { ProxyCache } from "../proxy-cache"
import { sleep } from "../../../../../editor/utils/helpers"

export class FileProxy extends DatabaseProxy {

    public static async get(id: number): Promise<FileProxy> {
        return await ProxyCache.getFileProxy(id)
    }

    public static async getFor(file: File): Promise<FileProxy> {
        return await ProxyCache.getFileProxyFor(file)
    }

    public static async load(id: number): Promise<FileProxy> {
        return new FileProxy(id)
    }

    public static async loadFrom(file: File): Promise<FileProxy> {
        return new FileProxy(file.id)
    }

    public constructor(id: number) {
        super(id)
    }

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

        const fileProxy          = await FileProxy.get(file.id)
        const { blockId, block } = await BlockProxy.createRootBlock(fileProxy, filePath)

        return { file: { filePath, file: fileProxy }, rootBlock: { blockId, block } }
    }

    private async normalizeLineOrder(insertOptions?: { insertPosition: LineProxy, insertCount?: number }): Promise<number[] | null> {
        const lines = await prismaClient.line.findMany({
            where:   { fileId: this.id },
            orderBy: { order: "asc" },
            select:  { id: true }
        })

        const insertPosition = insertOptions?.insertPosition
        const insertCount    = insertOptions?.insertCount ? insertOptions.insertCount : 1

        let insertionIndex: number | null = null
        const updates = lines.map((line, index) => {
            if (insertPosition !== undefined && line.id === insertPosition.id) { insertionIndex = index }
            return prismaClient.line.update({
                where: { id: line.id },
                data:  { order: insertionIndex ? index + insertCount + 1 : index + 1 },
            });
        });

        await prismaClient.$transaction(updates)

        if (insertionIndex) {
            const orderNumbers = []

            for (let i = 0; i < insertCount; i++) {
                orderNumbers.push(insertionIndex + i)
            }

            return orderNumbers
        } else {
            return null
        }
    }

    public readonly getFile = () => prismaClient.file.findUniqueOrThrow({ where: { id: this.id } })

    public async getEol(): Promise<string> {
        const file = await this.getFile()
        return file.eol
    }

    public async insertLines(lineContents: string[], relations?: { previous?: LineProxy, next?: LineProxy, sourceBlock?: BlockProxy }): Promise<{ line: LineProxy, v0: VersionProxy, v1: VersionProxy }[]> {
        const lineCount = lineContents.length
        
        const previous = relations?.previous
        const next     = relations?.next

        let orderNumbers: number[]
        if (previous && next) {
            const lines        = await prismaClient.line.findMany({ where: { id: { in: [previous.id, next.id] } }, select: { id: true, order: true } })
            const previousLine = lines.find(line => line.id === previous.id)!
            const nextLine     = lines.find(line => line.id === next.id)!

            const orderSpace = nextLine.order - previousLine.order
            if (orderSpace < 0.0000000001) {
                orderNumbers = await this.normalizeLineOrder({ insertPosition: next, insertCount: lineCount })
            } else {
                orderNumbers = lineContents.map((_, index) => previousLine.order + (orderSpace * (index + 1) / (lineCount + 1)))
            }
        } else if (previous) { 
            const previousLine = await prismaClient.line.findUniqueOrThrow({ where: { id: previous.id }, select: { order: true } })
            orderNumbers = lineContents.map((_, index) => previousLine.order + index + 1)
        } else if (next) {
            const nextLine = await prismaClient.line.findUniqueOrThrow({ where: { id: next.id }, select: { order: true } })

            if (nextLine.order < 0.0000000001) {
                orderNumbers = await this.normalizeLineOrder({ insertPosition: next, insertCount: lineCount })
            } else {
                orderNumbers = lineContents.map((_, index) => nextLine.order * ((index + 1) / (lineCount + 1)))
            }
        } else {
            orderNumbers = lineContents.map((_, index) => index + 1)
        }

        const versionData: Prisma.VersionCreateManyLineInput[][] = lineContents.map(content => {
            return [
                { timestamp: TimestampProvider.getTimestamp(), type: VersionType.PRE_INSERTION, isActive: false, content: "" },
                { timestamp: TimestampProvider.getTimestamp(), type: VersionType.INSERTION,     isActive: true,  content     }
            ]
        })

        if (relations?.sourceBlock) { versionData.forEach(versions => versions.forEach(version => version.sourceBlockId = relations.sourceBlock!.id)) }

        const lines = await prismaClient.$transaction(versionData.map((versions, index) => {
            return prismaClient.line.create({
                data: {
                    fileId: this.id,
                    order:  orderNumbers[index],
                    type:   LineType.INSERTED,
                    versions: {
                        createMany: {
                            data: versions
                        }
                    }
                },
                include: {
                    versions: {
                        orderBy: { timestamp: "asc" }
                    }
                }
            })
        }))

        return await Promise.all(lines.map(async line => { return { line: await LineProxy.getFor(line), v0: await VersionProxy.getFor(line.versions[0]), v1: await VersionProxy.getFor(line.versions[1]) }}))
    }

    public async prependLines(lineContents: string[]): Promise<{ line: LineProxy, v0: VersionProxy, v1: VersionProxy }[]> {
        const firstLine = await prismaClient.line.findFirst({ where: { fileId: this.id }, orderBy: { order: "asc" } })
        return await this.insertLines(lineContents, { next: firstLine ? await LineProxy.getFor(firstLine) : undefined })
    }

    public async appendLine(lineContents: string[]): Promise<{ line:LineProxy, v0: VersionProxy, v1: VersionProxy }[]> {
        const lastLine = await prismaClient.line.findFirst({ where: { fileId: this.id }, orderBy: { order: "desc" } })
        return await this.insertLines(lineContents, { previous: lastLine ? await LineProxy.getFor(lastLine) : undefined })
    }
}