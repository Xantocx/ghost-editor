import { prismaClient } from "../client"
import { FileProxy } from "./vcs-proxies/file-proxy"

export abstract class DatabaseProxy {

    public static readonly client = prismaClient
    
    public readonly client = prismaClient

    public readonly id: number

    protected constructor(id: number) {
        this.id = id
    }
}