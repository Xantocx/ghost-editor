import { randomUUID } from "crypto"

export abstract class DatabaseProxy {

    public readonly identity = randomUUID()

    public readonly id: number

    protected constructor(id: number) {
        this.id = id
    }
}