import { DatabaseProxy } from "../database-proxy"
import { randomUUID } from "crypto"
import { Prisma, VersionType, LineType, File } from "@prisma/client"
import { LineProxy, VersionProxy, BlockProxy } from "../../types"
import { prismaClient } from "../../client"
import { TimestampProvider } from "../../../core/metadata/timestamps"
import { ProxyCache } from "../proxy-cache"
import { ISessionFile } from "../../utilities"

export class FileProxy extends DatabaseProxy implements ISessionFile {

    public readonly eol:   string
    public          lines: LineProxy[]

    public static async get(id: number): Promise<FileProxy> {
        return await ProxyCache.getFileProxy(id)
    }

    public static async getFor(file: File): Promise<FileProxy> {
        return await ProxyCache.getFileProxyFor(file)
    }

    public static async load(id: number): Promise<FileProxy> {
        const file = await prismaClient.file.findUniqueOrThrow({ where: { id } })
        return await this.loadFrom(file)
    }

    public static async loadFrom(file: File): Promise<FileProxy> {
        const proxy = new FileProxy(file.id, file.eol)
        ProxyCache.registerFileProxy(proxy)

        const lines = await prismaClient.line.findMany({ where: { fileId: file.id }, orderBy: { order: "asc" } })
        proxy.lines = await Promise.all(lines.map(line => LineProxy.getFor(line)))

        return proxy
    }

    public constructor(id: number, eol: string) {
        super(id)
        this.eol = eol
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

        const fileProxy          = await FileProxy.getFor(file)
        const { blockId, block } = await BlockProxy.createRootBlock(fileProxy, filePath)

        return { file: { filePath, file: fileProxy }, rootBlock: { blockId, block } }
    }

    public getLinesFor(block: BlockProxy): LineProxy[] {
        if (this.lines === undefined) { return [] } // NOTE: this is a helper that allows blocks to not access unloaded lines in creation while loading a file
        return this.lines.filter(line => block.firstLine.order <= line.order && line.order <= block.lastLine.order)
    }

    private async normalizeLineOrder(insertOptions?: { insertPosition: LineProxy, insertCount?: number }): Promise<number[] | null> {
        const insertPosition = insertOptions?.insertPosition
        const insertCount    = insertOptions?.insertCount ? insertOptions.insertCount : 1

        let insertionIndex: number | null = null
        const updates = this.lines.map((line, index) => {
            if (insertPosition !== undefined && line.id === insertPosition.id) { insertionIndex = index }
            line.order = insertionIndex ? index + insertCount + 1 : index + 1
            return prismaClient.line.update({
                where: { id:    line.id },
                data:  { order: line.order },
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

    public async insertLines(lineContents: string[], relations?: { previous?: LineProxy, next?: LineProxy, sourceBlock?: BlockProxy }): Promise<{ line: LineProxy, v0: VersionProxy, v1: VersionProxy }[]> {
        const lineCount = lineContents.length
        
        if (lineCount === 0) { return [] }

        const previous = relations?.previous
        const next     = relations?.next

        let orderNumbers: number[]
        if (previous && next) {
            /*
            const lines        = await prismaClient.line.findMany({ where: { id: { in: [previous.id, next.id] } }, select: { id: true, order: true } })
            const previousLine = lines.find(line => line.id === previous.id)!
            const nextLine     = lines.find(line => line.id === next.id)!
            */

            const previousLine = this.lines.find(line => line.id === previous.id)
            const nextLine     = this.lines.find(line => line.id === next.id)

            const orderSpace = nextLine.order - previousLine.order
            if (orderSpace < 0.0000000001) {
                orderNumbers = await this.normalizeLineOrder({ insertPosition: next, insertCount: lineCount })
            } else {
                orderNumbers = lineContents.map((_, index) => previousLine.order + (orderSpace * (index + 1) / (lineCount + 1)))
            }
        } else if (previous) { 
            //const previousLine = await prismaClient.line.findUniqueOrThrow({ where: { id: previous.id }, select: { order: true } })
            const previousLine = this.lines.find(line => line.id === previous.id)

            orderNumbers = lineContents.map((_, index) => previousLine.order + index + 1)
        } else if (next) {
            //const nextLine = await prismaClient.line.findUniqueOrThrow({ where: { id: next.id }, select: { order: true } })
            const nextLine = this.lines.find(line => line.id === next.id)

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

        const lineData = await Promise.all(lines.map(async line => { return { line: await LineProxy.getFor(line), v0: await VersionProxy.getFor(line.versions[0]), v1: await VersionProxy.getFor(line.versions[1]) }}))
        const newLines = lineData.map(({ line, v0, v1 }) => line)

        if (previous) {
            const previousIndex = this.lines.findIndex(line => line.id === previous.id)
            this.lines.splice(previousIndex + 1, 0, ...newLines)
        } else if (next) {
            const nextIndex = this.lines.findIndex(line => line.id === next.id)
            this.lines.splice(nextIndex, 0, ...newLines)
        } else {
            this.lines = newLines
        }

        return lineData
    }

    public async prependLines(lineContents: string[]): Promise<{ line: LineProxy, v0: VersionProxy, v1: VersionProxy }[]> {
        const firstLine = await prismaClient.line.findFirst({ where: { fileId: this.id }, orderBy: { order: "asc" } })
        return await this.insertLines(lineContents, { next: firstLine ? await LineProxy.getFor(firstLine) : undefined })
    }

    public async appendLine(lineContents: string[]): Promise<{ line:LineProxy, v0: VersionProxy, v1: VersionProxy }[]> {
        const lastLine = await prismaClient.line.findFirst({ where: { fileId: this.id }, orderBy: { order: "desc" } })
        return await this.insertLines(lineContents, { previous: lastLine ? await LineProxy.getFor(lastLine) : undefined })
    }

    public async updateFilePath(filePath: string): Promise<void> {
        await prismaClient.file.update({
            where: { id: this.id },
            data:  { filePath }
        })
    }
}