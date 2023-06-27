import { prismaClient } from "../client"
import { FileProxy } from "./vcs-proxies/file-proxy"

export abstract class DatabaseProxy {

    public static readonly client = prismaClient
    
    public readonly client = prismaClient

    public readonly id: number

    public constructor(id: number) {
        this.id = id
    }
}

export abstract class FileDatabaseProxy extends DatabaseProxy {

    public readonly file: FileProxy

    public constructor(id: number, file: FileProxy) {
        super(id)
        this.file = file
    }
}