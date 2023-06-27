import { Prisma } from "@prisma/client"
import { DatabaseProxy } from "../database-proxy"
import { FileProxy, LineProxy, VersionProxy } from "../../types"
import { prismaClient } from "../../client"

export class BlockProxy extends DatabaseProxy {

    public readonly file: FileProxy

    public constructor(id: number, file: FileProxy) {
        super(id)
        this.file = file
    }

    public static async create(blockId: string, file: FileProxy, relations?: { headInfo?: Map<LineProxy, VersionProxy>, parent?: BlockProxy, origin?: BlockProxy }): Promise<BlockProxy> {
        const blockData: Prisma.BlockCreateInput = {
            blockId,
            file: { connect: { id: file.id } },
            isRoot: relations ? (relations.parent === undefined && relations.origin === undefined) : false
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

        const block = await this.client.block.create({ data: blockData })

        return new BlockProxy(block.id, file)
    }

    public async insertLine(content: string, location?: { previous?: LineProxy, next?: LineProxy }): Promise<{ line:LineProxy, v0: VersionProxy, v1: VersionProxy }> {
        return await this.file.insertLine(content, { previous: location?.previous, next: location?.next, sourceBlock: this })
    }

    // TODO: TEST!!!
    public async prependLine(content: string): Promise<{ line:LineProxy, v0: VersionProxy, v1: VersionProxy }> {
        const nextLine     = await this.client.line.findFirst({ where: { fileId: this.file.id, blocks: { some: { id: this.id } }                                }, orderBy: { order: "asc"  }, select: { id: true, order: true } })
        const previousLine = await this.client.line.findFirst({ where: { fileId: this.file.id, blocks: { none: { id: this.id } }, order: { lt: nextLine.order } }, orderBy: { order: "desc" }, select: { id: true              } })
        
        return await this.insertLine(content, { previous: previousLine ? new LineProxy(previousLine.id) : undefined,
                                                next:     nextLine     ? new LineProxy(nextLine.id)     : undefined })
    }

    // TODO: TEST!!!
    public async appendLine(content: string): Promise<{ line:LineProxy, v0: VersionProxy, v1: VersionProxy }> {
        const previousLine = await this.client.line.findFirst({ where: { fileId: this.file.id, blocks: { some: { id: this.id } }                                    }, orderBy: { order: "desc" }, select: { id: true, order: true } })
        const nextLine     = await this.client.line.findFirst({ where: { fileId: this.file.id, blocks: { none: { id: this.id } }, order: { gt: previousLine.order } }, orderBy: { order: "asc"  }, select: { id: true              } })
        
        return await this.insertLine(content, { previous: previousLine ? new LineProxy(previousLine.id) : undefined,
                                                next:     nextLine     ? new LineProxy(nextLine.id)     : undefined })
    }

    public async addLines(lineVersions: Map<LineProxy, VersionProxy>): Promise<void> {
        const lines = Array.from(lineVersions.keys())
        await this.client.block.update({
            where: { id: this.id },
            data:  {
                lines: { connect: lines.map(line => { return { id: line.id } }) },
                heads: {
                    createMany: {
                        data: lines.map(line => {
                            return {
                                lineId:    line.id,
                                versionId: lineVersions.get(line)!.id
                            }
                        })
                    }
                }
            }
        })
    }
}