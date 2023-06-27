import { FileDatabaseProxy } from "../database-proxy"
import { BlockProxy, VersionProxy } from "../../types"
import { VersionType } from "@prisma/client"

export class LineProxy extends FileDatabaseProxy {

    /*
    // Nice in theory, but under the current circumstances unnecessary and slow

    public async getPreviousLine(): Promise<LineProxy | undefined> {
        const line     = await this.client.line.findUniqueOrThrow({ where: { id: this.id } })
        const previous = await this.client.line.findFirst({
            where:   { fileId: line.fileId, order: { lt: line.order } },
            orderBy: { order: "desc" }
        })

        return previous ? new LineProxy(previous.id) : undefined
    }

    public async getNextLine(): Promise<LineProxy | undefined> {
        const line = await this.client.line.findUniqueOrThrow({ where: { id: this.id } })
        const next = await this.client.line.findFirst({
            where:   { fileId: line.fileId, order: { gt: line.order } },
            orderBy: { order: "asc" }
        })

        return next ? new LineProxy(next.id) : undefined
    }
    */

    public async addBlock(block: BlockProxy, headVersion: VersionProxy): Promise<void> {
        await this.client.line.update({
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
        const head = await prisma.head.findFirstOrThrow({ where: { blockId: block.id, lineId: this.id } })
        return head
        */
    }

    public async addBlocks(headInfo: Map<BlockProxy, VersionProxy>): Promise<void> {
        const blocks = Array.from(headInfo.keys())

        await this.client.$transaction([
            this.client.line.update({
                where: { id: this.id },
                data:  { blocks: { connect: blocks.map(block => { return { id: block.id } }) } }
            }),
            this.client.head.createMany({
                data: blocks.map(block => {
                    return {
                        blockId:   block.id,
                        lineId:    this.id,
                        versionId: headInfo.get(block)!.id
                    }
                })
            })
        ])

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

    //{ timestamp: timestamp++, versionType: VersionType.INSERTION,     isActive: false, content     }

    public async updateContent(content: string, sourceBlock: BlockProxy): Promise<VersionProxy> {

        // TODO: lacks cloning in case I am not up-to-date, as well as head-tracking

        if (sourceBlock) {

            const [latestVersion, latestTracking, head] = await this.client.$transaction([
                this.client.version.findFirstOrThrow({
                    where:   { lineId: this.id },
                    orderBy: { timestamp: "desc" }
                }),
                this.client.version.findFirst({
                    where:   { lineId: this.id },
                    orderBy: { trackedTimestamps: "" }
                }),
                this.client.head.findUnique({ where: { blockId_lineId: { blockId: sourceBlock.id, lineId: this.id } } })
            ])

            if (latestVersion.id !== head.versionId) {
                // clone + head-tracking -> more cases needed as well
            }
        }

        const version = await this.client.version.create({
            data: {
                lineId: this.id,
                timestamp: timestamp++,
                versionType: VersionType.CHANGE,
                isActive: true,
                content,
                sourceBlockId: sourceBlock?.id
            }
        })

        if (sourceBlock) {
            await this.client.head.update({
                where: { blockId_lineId: { blockId: sourceBlock.id, lineId: this.id } },
                data:  { versionId: version.id }
            })
        }

        return new VersionProxy(version.id)
    }
}