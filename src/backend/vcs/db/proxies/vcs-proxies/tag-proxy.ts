import { Tag } from "@prisma/client";
import { DatabaseProxy } from "../database-proxy"
import { prismaClient } from "../../client";
import { ProxyCache } from "../proxy-cache";
import { ISessionTag } from "../../utilities";
import { BlockProxy } from "./block-proxy";
import { VCSBlockId, VCSTagId, VCSTagInfo } from "../../../../../app/components/vcs/vcs-rework";

export class TagProxy extends DatabaseProxy implements ISessionTag {

    public readonly tagId:       string
    public readonly tagBlock:    BlockProxy
    public readonly sourceBlock: BlockProxy
    public readonly name:        string
    public readonly code:        string
    public readonly description: string

    private _timestamp: number
    public get timestamp(): number{ return this._timestamp }

    public async setTimestamp(newTimestamp: number): Promise<void> {
        const updatedTag = await prismaClient.tag.update({
            where: { id: this.id },
            data:  { timestamp: newTimestamp }
        })

        this._timestamp = updatedTag.timestamp
    }

    public static async get(id: number): Promise<TagProxy> {
        return await ProxyCache.getTagProxy(id)
    }

    public static async getFor(tag: Tag): Promise<TagProxy> {
        return await ProxyCache.getTagProxyFor(tag)
    }

    public static async load(id: number): Promise<TagProxy> {
        const tag = await prismaClient.tag.findUniqueOrThrow({ where: { id } })
        return await this.loadFrom(tag)
    }

    public static async loadFrom(tag: Tag): Promise<TagProxy> {
        const tagBlock    = await BlockProxy.get(tag.tagBlockId)
        const sourceBlock = await BlockProxy.get(tag.sourceBlockId)

        return new TagProxy(tag.id, tag.tagId, tagBlock, sourceBlock, tag.name, tag.timestamp, tag.code, tag.description)
    }

    private constructor(id: number, tagId: string, tagBlock: BlockProxy, sourceBlock: BlockProxy, name: string, timestamp: number, code: string, description: string) {
        super(id)
        this.tagId       = tagId
        this.tagBlock    = tagBlock
        this.sourceBlock = sourceBlock
        this.name        = name
        this._timestamp  = timestamp
        this.code        = code
        this.description = description
    }

    public async asTagInfo(sourceBlockId: VCSBlockId): Promise<VCSTagInfo> {
        return new VCSTagInfo(VCSTagId.createFrom(sourceBlockId, this.tagId),
                              VCSBlockId.createFrom(sourceBlockId, this.tagBlock.blockId),
                              this.name,
                              this.timestamp,
                              this.code,
                              this.description,
                              false)
    }
}