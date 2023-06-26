import { prismaClient } from "../client"

export abstract class DatabaseProxy {

    public static readonly client = prismaClient
    
    public readonly client = prismaClient

    public readonly id: number

    public constructor(id: number) {
        this.id = id
    }
}