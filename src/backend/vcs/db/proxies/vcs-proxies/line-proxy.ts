import { prismaClient } from "../../client";
import { FileDatabaseProxy } from "../database-proxy";
import { VersionProxy, BlockProxy } from "../../types";
import { HeadList, Line, Prisma, Version, VersionType } from "@prisma/client"
import { FileProxy } from "./file-proxy";

export class LineProxy extends FileDatabaseProxy {

    public static createFrom(line: Line, file?: FileProxy): LineProxy {
        file = file ? file : new FileProxy(line.fileId)
        return new LineProxy(line.id, file)
    }

    public readonly getBlocks = () => prismaClient.block.findMany({ where: { lines: { some: { id: this.id } } } })

    public readonly getLatestVersion = () => prismaClient.version.findFirstOrThrow({
        where:   { lineId: this.id },
        orderBy: { timestamp: "desc" }
    })

    public readonly getLatestTracking = () => prismaClient.trackedVersion.findFirst({
        where:   { lineId: this.id },
        orderBy: { timestamp: "desc" }
    })

    public async addBlocks(blockVersions: Map<BlockProxy, VersionProxy>): Promise<void> {
        const blocks = Array.from(blockVersions.keys())

        const updates = blocks.map(block => {
            return prismaClient.block.update({
                where: { id: block.id },
                data:  {
                    lines:       { connect: { id: this.id } },
                    headList: { 
                        update: {
                            versions: { connect: { id: blockVersions.get(block)!.id } }
                        }
                    }
                }
            })
        })

        await prismaClient.$transaction(updates)

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

    private async createNewVersion(isActive: boolean, content: string, sourceBlock?: BlockProxy): Promise<VersionProxy> {
        let version: Version

        const versionConfig: Prisma.VersionUncheckedCreateInput = {
            lineId:    this.id,
            timestamp: timestamp++,
            type:      isActive ? VersionType.CHANGE : VersionType.DELETION,
            isActive:  isActive,
            content
        }

        if (sourceBlock) {
            const [headList, head, latestVersion, latestTracking] = await prismaClient.$transaction([
                sourceBlock.getHeadList(),
                sourceBlock.getHeadFor(this),
                this.getLatestVersion(),
                this.getLatestTracking()
            ])

            if (!head) { throw new Error("Cannot find head in block for line updated by the same block! This should not be possible!") }

            versionConfig.sourceBlockId = sourceBlock.id

            // TODO: experimental. expectation: should not revert to original timetravel state, but to timetravel state + 1 change
            if (latestVersion.id !== head.id) {
                versionConfig.originId = head.id
            } 
            
            // TODO: is this condition too broad? should it be &&?
            if (latestTracking && (latestTracking.timestamp > head.timestamp || latestTracking.versionId !== head.id)) {
                await prismaClient.trackedVersion.create({
                    data: {
                        timestamp: timestamp++,
                        lineId:    this.id,
                        versionId: head.id
                    }
                })
            }

            version = await prismaClient.version.create({data: versionConfig })

            await prismaClient.headList.update({
                where: { id: headList.id },
                data:  {
                    versions: {
                        connect:    { id: version.id },
                        disconnect: { id: head.id }
                    }
                }
            })
        } else {
            version = await prismaClient.version.create({data: versionConfig })
        }

        return new VersionProxy(version.id)
    }

    public async updateContent(content: string, sourceBlock?: BlockProxy): Promise<VersionProxy> {
        return await this.createNewVersion(true, content, sourceBlock)        
    }

    public async delete(sourceBlock?: BlockProxy): Promise<VersionProxy> {
        return await this.createNewVersion(false, "", sourceBlock)   
    }
}