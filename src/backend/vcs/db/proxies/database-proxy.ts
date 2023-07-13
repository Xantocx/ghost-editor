export abstract class DatabaseProxy {

    public readonly id: number

    protected constructor(id: number) {
        this.id = id
    }
}