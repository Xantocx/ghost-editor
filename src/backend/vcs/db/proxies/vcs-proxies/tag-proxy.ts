import { Tag } from "@prisma/client";
import { DatabaseProxy } from "../database-proxy"
import { prismaClient } from "../../client";
import { ProxyCache } from "../proxy-cache";
import { ISessionTag } from "../../utilities";

export class TagProxy extends DatabaseProxy implements ISessionTag {

    public readonly timestamp: number

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
        return new TagProxy(tag.id, tag.timestamp)
    }

    private constructor(id: number, timestamp: number) {
        super(id)
        this.timestamp = timestamp
    }
}