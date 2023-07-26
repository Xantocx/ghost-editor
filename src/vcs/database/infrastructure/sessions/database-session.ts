import Session, { NewFileInfo } from "../../session"
import { FileProxy, LineProxy, VersionProxy, BlockProxy, TagProxy } from "../../proxy-types"
import { prismaClient } from "../../client"
import { BlockType, LineType, VersionType } from "../../data-types/enums"
import { PrismaPromise, Block, Tag } from "@prisma/client"
import { VCSBlockId, VCSTagId, VCSFileId, VCSFileData, VCSLineData, VCSVersionData, VCSBlockData, VCSTagData } from "../../../provider"

export default class DBSession extends Session<FileProxy, LineProxy, VersionProxy, BlockProxy, TagProxy> {

    public async createSessionFile(filePath: string | undefined, eol: string, content?: string): Promise<NewFileInfo<FileProxy, LineProxy, BlockProxy, TagProxy>> {
        return await FileProxy.create(filePath, eol, content)
    }

    public async getRootSessionBlockFor(filePath: string): Promise<BlockProxy | undefined> {
        //const fileData = await prismaClient.file.findFirstOrThrow({ where: { filePath } })
        //const file     = await FileProxy.getFor(fileData)

        const rootBlock = await prismaClient.block.findFirst({
            where: {
                file: { filePath },
                type: BlockType.ROOT
            },
        })

        return rootBlock ? await this.getSessionBlockFrom(rootBlock) : undefined
    }

    public async getSessionBlockFrom(block: Block): Promise<BlockProxy> {
        return await BlockProxy.getFor(block)
    }

    public async getSessionBlockFor(blockId: VCSBlockId): Promise<BlockProxy | undefined> {
        const block = await prismaClient.block.findFirst({ where: { blockId: blockId.blockId } })
        return block ? await this.getSessionBlockFrom(block) : undefined
    }

    public async getSessionTagFrom(tag: Tag): Promise<TagProxy> {
        return await TagProxy.getFor(tag)
    }

    public async getSessionTagFor(tagId: VCSTagId): Promise<TagProxy> {
        const tag = await prismaClient.tag.findFirst({ where: { tagId: tagId.tagId } })
        return tag ? await this.getSessionTagFrom(tag) : undefined
    }

    public async deleteSessionBlock(block: BlockProxy): Promise<void> {

        const file     = block.file
        const fileData = await prismaClient.file.findUniqueOrThrow({ where: { id: file.id }, include: { lines: true } })

        const prismaOperations: PrismaPromise<unknown>[] = []

        function removeBlock(block: BlockProxy): number {
            prismaOperations.push(prismaClient.block.update({
                where: { id: block.id },
                data: {
                    file:              { disconnect: true },
                    fileAfterDeletion: { connect:    { id: fileData.id } },
                    lines:             { disconnect: fileData.lines.map(line => { return { id: line.id } })},
                    parent:            { disconnect: true },
                    origin:            { disconnect: true }
                }
            }))

            block.clones.map(clone => removeBlock(clone))
            const timestamps = block.children.map(child => removeBlock(child))
            const timestamp  = Math.max(...timestamps)

            file.lines.forEach(line => {
                const index = line.blocks.findIndex(lineBlock => block.id === lineBlock.id)
                if (index > -1) { line.blocks.splice(index, 1) }
            })

            if (block.parent) {
                const parent = block.parent
                const index  = parent.children.findIndex(child => block.id === child.id)
                if (index > -1) { parent.children.splice(index, 1) }
            }

            if (block.origin) {
                const origin = block.origin
                const index  = origin.clones.findIndex(clone => block.id === clone.id)
                if (index > -1) { origin.clones.splice(index, 1) }
            }

            return Math.max(block.timestamp, timestamp)
        }

        const parent    = block.parent
        const timestamp = removeBlock(block)
        
        if (parent && parent.timestamp < timestamp) {
            await parent.setTimestamp(timestamp)
        }

        await prismaClient.$transaction(prismaOperations)
    }

    public async getFileData(fileId: VCSFileId): Promise<VCSFileData> {
        const fileProxy = this.getFile(fileId)
        const file      = await prismaClient.file.findUniqueOrThrow({
            where:   { id: fileProxy.id },
            include: {
                lines: {
                    include: {
                        versions: {
                            orderBy: {
                                timestamp: "asc"
                            }
                        }
                    },
                    orderBy: {
                        order: "asc"
                    }
                },
                blocks: {
                    include: {
                        lines: {
                            select: {
                                id: true,
                                versions: {
                                    select: {
                                        id:        true,
                                        timestamp: true
                                    },
                                    orderBy: {
                                        timestamp: "asc"
                                    }
                                } 
                            },
                            orderBy: {
                                order: "asc"
                            }
                        },
                        tags: {
                            orderBy: {
                                timestamp: "asc"
                            }
                        }
                    }
                }
            }
        })

        const fileData = new VCSFileData(file.id, fileId, file.eol)

        // map lines, add to file
        const lineData = new Map(file.lines.map((line, index) => [line.id, new VCSLineData(line.id, fileData, line.type as LineType, index)]))
        fileData.lines = Array.from(lineData.values())

        // map blocks, add to file -> lacks heads, parent, origin, tags
        const blockData    = new Map(file.blocks.map(block => [block.id, new VCSBlockData(block.id, block.blockId, fileData, block.type as BlockType)]))
        const blocks       = Array.from(blockData.values())
        fileData.rootBlock = blocks.find(block => block.type === BlockType.ROOT)
        fileData.blocks    = blocks

        // map versions, add to line -> lacks origin
        const versions = file.lines.flatMap(line => {
            const lineInfo    = lineData.get(line.id)
            lineInfo.versions = line.versions.map(version => {
                const sourceBlock = version.sourceBlockId ? blockData.get(version.sourceBlockId) : undefined
                return new VCSVersionData(version.id, lineInfo, version.type as VersionType, version.timestamp, version.isActive, version.content, sourceBlock, undefined)
            })
            return lineInfo.versions
        })
        const versionData = new Map(versions.map(version => [version.databaseId, version]))

        // complete versions with origin
        file.lines.forEach(line => line.versions.forEach(version => {
            if (version.originId) { versionData.get(version.id).origin = versionData.get(version.originId) }
        }))

        // complete blocks with heads, origin, parent, and tags
        file.blocks.forEach(block => {
            const blockInfo     = blockData.get(block.id)
            const headTimestamp = block.timestamp

            blockInfo.heads = new Map(block.lines.map(line => {
                const lineInfo = lineData.get(line.id)
                const version  = line.versions.find((version, index, versions) => { return version.timestamp <= headTimestamp && (index + 1 < versions.length ? headTimestamp < versions[index + 1].timestamp : true) })
                return [lineInfo, versionData.get(version.id)]
            }))

            if (block.parentId) { blockInfo.parent = blockData.get(block.parentId) }
            if (block.originId) { blockInfo.origin = blockData.get(block.originId) }

            blockInfo.tags = block.tags.map(tag => new VCSTagData(tag.id, tag.tagId, blockInfo, tag.name, tag.timestamp, tag.code))
        })

        // return complete file data
        return fileData
    }
}