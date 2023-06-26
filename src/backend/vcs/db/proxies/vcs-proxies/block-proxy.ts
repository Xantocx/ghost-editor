import { Prisma } from "@prisma/client"
import { DatabaseProxy } from "../database-proxy"
import { FileProxy, LineProxy, VersionProxy } from "../../types"
import { prismaClient } from "../../client"

export class BlockProxy extends DatabaseProxy {

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

        return new BlockProxy(block.id)
    }
}