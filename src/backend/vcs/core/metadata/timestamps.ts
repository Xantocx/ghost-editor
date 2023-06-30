export type Timestamp = number

export class TimestampProvider {

    private static nextTimestamp: Timestamp = Math.floor(Math.random() * 100000000)

    public static setupNextTimestamp(timestamp: Timestamp): void {
        this.nextTimestamp = timestamp
    }

    public static getLastTimestamp(): Timestamp {
        return this.nextTimestamp - 1
    }

    public static getTimestamp(): Timestamp {
        const timestamp = this.nextTimestamp
        this.nextTimestamp++
        return timestamp
    }
}