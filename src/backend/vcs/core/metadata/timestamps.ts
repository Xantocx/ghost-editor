import { prismaClient } from "../../db/client"

export type Timestamp = number

export class TimestampProvider {

    private static id:            number
    private static nextTimestamp: Timestamp

    private static updateOperation: Promise<any> = Promise.resolve() 

    public static async setup(): Promise<void> {
        let timestamp = await prismaClient.timestamp.findFirst()
        if (timestamp === null) {
            timestamp = await prismaClient.timestamp.create({})
        }

        this.id            = timestamp.id
        this.nextTimestamp = timestamp.timestamp
    }

    public static getLastTimestamp(): Timestamp {
        return this.nextTimestamp - 1
    }

    public static getTimestamp(): Timestamp {
        const timestamp = this.nextTimestamp
        this.nextTimestamp++

        this.updateOperation = this.updateOperation.then(async () => {
            await prismaClient.timestamp.update({
                where: { id:        this.id },
                data:  { timestamp: this.nextTimestamp }
            })
        })

        return timestamp
    }

    public static async flush(): Promise<void> {
        await this.updateOperation
    }
}