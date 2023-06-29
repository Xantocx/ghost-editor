import { BlockType, Prisma } from "@prisma/client"
import { FileDatabaseProxy } from "../database-proxy"
import { FileProxy, HeadProxy, LineProxy, VersionProxy } from "../../types"
import { DBBlock } from "../../../core/block"

export class BlockProxy extends FileDatabaseProxy {

    public static async createRootBlock(file: FileProxy, filePath: string, lineVersions?: Map<LineProxy, VersionProxy>): Promise<BlockProxy> {
        const block = await this.client.block.create({
            data: {
                blockId: filePath + ":root",
                fileId:  file.id,
                type:    BlockType.ROOT,
            }
        })

        const proxy = new BlockProxy(block.id, file)

        if (lineVersions) { proxy.addLines(lineVersions) }

        return proxy
    }

    public static async createCloneBlock(origin: DBBlock, lineVersions?: Map<LineProxy, VersionProxy>): Promise<BlockProxy> {
        const [originData, cloneCount] = await this.client.$transaction([
            origin.getBlock(),
            origin.getCloneCount()
        ])

        const block = await this.client.block.create({
            data: {
                blockId:  `${originData.blockId}:inline${cloneCount}`,
                fileId:   origin.file.id,
                type:     BlockType.CLONE,
                originId: origin.id
            }
        })

        const proxy = new BlockProxy(block.id, origin.file)

        if (lineVersions) { proxy.addLines(lineVersions) }

        return proxy
    }

    public static async createInlineBlock(parent: DBBlock, heads: HeadProxy[]): Promise<BlockProxy> {
        const [parentData, childrenCount, lines] = await this.client.$transaction([
            parent.getBlock(),
            parent.getChildrenCount(),
            parent.getActiveLines()
        ])

        const block = await this.client.block.create({
            data: {
                blockId:  `${parentData.blockId}:inline${childrenCount}`,
                fileId:   parentData.fileId,
                type:     BlockType.INLINE,
                lines:    { connect: lines.map(line => { return { id: line.id } }) },
                heads:    { connect: heads.map(head => { return { id: head.id } }) },
                parentId: parent.id
            }
        })

        return new BlockProxy(block.id, parent.file)
    }

    public async insertLine(content: string, location?: { previous?: LineProxy, next?: LineProxy }): Promise<{ line:LineProxy, v0: VersionProxy, v1: VersionProxy }> {
        return await this.file.insertLine(content, { previous: location?.previous, next: location?.next, sourceBlock: this })
    }

    // TODO: TEST!!!
    public async prependLine(content: string): Promise<{ line: LineProxy, v0: VersionProxy, v1: VersionProxy }> {
        const nextLine     = await this.client.line.findFirst({ where: { fileId: this.file.id, blocks: { some: { id: this.id } }                                }, orderBy: { order: "asc"  }, select: { id: true, order: true } })
        const previousLine = await this.client.line.findFirst({ where: { fileId: this.file.id, blocks: { none: { id: this.id } }, order: { lt: nextLine.order } }, orderBy: { order: "desc" }, select: { id: true              } })
        
        return await this.insertLine(content, { previous: previousLine ? new LineProxy(previousLine.id, this.file) : undefined,
                                                next:     nextLine     ? new LineProxy(nextLine.id, this.file)     : undefined })
    }

    // TODO: TEST!!!
    public async appendLine(content: string): Promise<{ line:LineProxy, v0: VersionProxy, v1: VersionProxy }> {
        const previousLine = await this.client.line.findFirst({ where: { fileId: this.file.id, blocks: { some: { id: this.id } }                                    }, orderBy: { order: "desc" }, select: { id: true, order: true } })
        const nextLine     = await this.client.line.findFirst({ where: { fileId: this.file.id, blocks: { none: { id: this.id } }, order: { gt: previousLine.order } }, orderBy: { order: "asc"  }, select: { id: true              } })
        
        return await this.insertLine(content, { previous: previousLine ? new LineProxy(previousLine.id, this.file) : undefined,
                                                next:     nextLine     ? new LineProxy(nextLine.id, this.file)     : undefined })
    }

    public async addLines(lineVersions: Map<LineProxy, VersionProxy>): Promise<void> {
        const lines = Array.from(lineVersions.keys())

        await this.client.head.createMany({
            data: lines.map(line => {
                return {
                    ownerBlockId: this.id,
                    lineId:       line.id,
                    versionId:    lineVersions.get(line)!.id
                } 
            })
        })

        const heads = await this.client.head.findMany({ where: { ownerBlockId: this.id } })

        await this.client.block.update({
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
}