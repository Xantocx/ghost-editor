import { Tag } from "@prisma/client";
import { DatabaseProxy } from "../database-proxy"
import { prismaClient } from "../../client";
import { ProxyCache } from "../proxy-cache";
import { ISessionTag } from "../../utilities";
import { BlockProxy } from "./block-proxy";
import { VCSBlockId, VCSTagId, VCSTagInfo } from "../../../../../app/components/vcs/vcs-rework";

export class TagProxy extends DatabaseProxy implements ISessionTag {

    public readonly tagId:       string
    public readonly block:       BlockProxy
    public readonly name:        string
    public readonly timestamp:   number
    public readonly code:        string
    public readonly description: string

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
        const block = await BlockProxy.get(tag.blockId)
        return new TagProxy(tag.id, tag.tagId, block, tag.name, tag.timestamp, tag.code, tag.description)
    }

    private constructor(id: number, tagId: string, block: BlockProxy, name: string, timestamp: number, code: string, description: string) {
        super(id)
        this.tagId       = tagId
        this.block       = block
        this.name        = name
        this.timestamp   = timestamp
        this.code        = code
        this.description = description
    }

    public async asTagInfo(blockId: VCSBlockId): Promise<VCSTagInfo> {
        return new VCSTagInfo(VCSTagId.createFrom(blockId, this.tagId),
                              this.name,
                              this.timestamp,
                              this.code,
                              this.description,
                              false)
    }
}