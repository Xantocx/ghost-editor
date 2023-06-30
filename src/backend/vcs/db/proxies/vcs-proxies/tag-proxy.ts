import { Tag } from "@prisma/client";
import { DatabaseProxy } from "../database-proxy"

export class TagProxy extends DatabaseProxy {

    public readonly timestamp: number

    public static createFrom(tag: Tag): TagProxy {
        return new TagProxy(tag.id, tag.timestamp)
    }

    public constructor(id: number, timestamp: number) {
        super(id)
        this.timestamp = timestamp
    }
}