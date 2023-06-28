import { FileDatabaseProxy } from "../database-proxy"
import { BlockProxy, VersionProxy } from "../../types"
import { Prisma, VersionType } from "@prisma/client"

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

    public readonly getBlocks = () => this.client.block.findMany({ where: { lines: { some: { id: this.id } } } })

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

        const versionData: (Prisma.Without<Prisma.VersionCreateInput, Prisma.VersionUncheckedCreateInput> & Prisma.VersionUncheckedCreateInput) = {
            lineId: this.id,
            timestamp: timestamp++,
            versionType: VersionType.CHANGE,
            isActive: true,
            content
        }

        if (sourceBlock) {

            versionData.sourceBlockId = sourceBlock.id

            const [latestVersion, latestTracking, head] = await this.client.$transaction([
                this.client.version.findFirstOrThrow({
                    where:   { lineId: this.id },
                    orderBy: { timestamp: "desc" }
                }),
                this.client.trackedVersion.findFirst({
                    where:   { lineId: this.id },
                    orderBy: { timestamp: "desc" }
                }),
                this.client.head.findUnique({ where: { blockId_lineId: { blockId: sourceBlock.id, lineId: this.id } }, include: { version: { select: { timestamp: true } } } })
            ])

            // TODO: experimental. expectation: should not revert to original timetravel state, but to timetravel state + 1 change
            if (latestVersion.id !== head.versionId) {
                versionData.originId = head.versionId
            } 
            
            // TODO: is this condition too broad? should it be &&?
            if (latestTracking.timestamp > head.version.timestamp || latestTracking.versionId !== head.versionId) {
                await this.client.trackedVersion.create({
                    data: {
                        timestamp: timestamp++,
                        lineId:    this.id,
                        versionId: head.versionId
                    }
                })
            }
        }

        const version = await this.client.version.create({ data: versionData })

        if (sourceBlock) {
            await this.client.head.update({
                where: { blockId_lineId: { blockId: sourceBlock.id, lineId: this.id } },
                data:  { versionId: version.id }
            })
        }

        return new VersionProxy(version.id)
    }
}