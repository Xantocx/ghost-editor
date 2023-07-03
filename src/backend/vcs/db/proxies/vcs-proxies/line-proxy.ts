import { prismaClient } from "../../client";
import { FileDatabaseProxy } from "../database-proxy";
import { VersionProxy, BlockProxy } from "../../types";
import { HeadList, Line, Prisma, Version, VersionType } from "@prisma/client"
import { FileProxy } from "./file-proxy";
import { VCSBlockId, VCSFileId } from "../../../../../app/components/vcs/vcs-rework";
import { TimestampProvider } from "../../../core/metadata/timestamps";

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

    public async getBlockIds(): Promise<string[]> {
        const blocks = await this.getBlocks()
        return blocks.map(block => block.blockId)
    }

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
    }

    public async updateHeadTrackingFor(block: BlockProxy): Promise<void> {
        const [head, latestVersion, latestTracking] = await prismaClient.$transaction([
            block.getHeadFor(this),
            this.getLatestVersion(),
            this.getLatestTracking()
        ])

        if ((latestTracking && latestTracking.timestamp > head.timestamp) || latestVersion.id !== head.id) {
            await prismaClient.trackedVersion.create({
                data: {
                    timestamp: TimestampProvider.getTimestamp(),
                    lineId:    this.id,
                    versionId: head.id
                }
            })
        }
    }

    private async createNewVersion(isActive: boolean, content: string, sourceBlock?: BlockProxy): Promise<VersionProxy> {
       let version: Version

        if (sourceBlock) {
            const [headList, head, latestVersion, latestTracking] = await prismaClient.$transaction([
                sourceBlock.getHeadList(),
                sourceBlock.getHeadFor(this),
                this.getLatestVersion(),
                this.getLatestTracking()
            ])

            if (!head) { throw new Error("Cannot find head in block for line updated by the same block! This should not be possible!") }

            // TODO: works great, but way to slow...
            await sourceBlock.updateHeadTracking()

            const versionConfig: Prisma.VersionUncheckedCreateInput = {
                lineId:        this.id,
                timestamp:     TimestampProvider.getTimestamp(),
                type:          isActive ? VersionType.CHANGE : VersionType.DELETION,
                isActive:      isActive,
                sourceBlockId: sourceBlock.id,
                content
            }

            // TODO: experimental. expectation: should not revert to original timetravel state, but to timetravel state + 1 change
            if (latestVersion.id !== head.id) {
                versionConfig.originId = head.id
            } 

            // DEBUG: Remove later
            if ((latestTracking && latestTracking.timestamp > head.timestamp) || latestVersion.id !== head.id) {
                console.log(latestVersion)
                console.log(head)
                console.log("-----------------------------")
            }

            version = await prismaClient.version.create({ data: versionConfig })

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
            version = await prismaClient.version.create({
                data: {
                    lineId:    this.id,
                    timestamp: TimestampProvider.getTimestamp(),
                    type:      isActive ? VersionType.CHANGE : VersionType.DELETION,
                    isActive:  isActive,
                    content
                }
            })
        }

        return new VersionProxy(version.id)
    }

    public async updateContent(content: string, sourceBlock?: BlockProxy): Promise<VersionProxy> {
        let previousVersion: Version
        if (sourceBlock) { previousVersion = await sourceBlock.getHeadFor(this) }
        else             { previousVersion = await this.getLatestVersion() }

        if (previousVersion.content.trimEnd() === content.trimEnd()) {
            return new VersionProxy(previousVersion.id)
        } else {
            return await this.createNewVersion(true, content, sourceBlock)  
        }      
    }

    public async delete(sourceBlock?: BlockProxy): Promise<VersionProxy> {
        return await this.createNewVersion(false, "", sourceBlock)   
    }
}