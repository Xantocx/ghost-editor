import "reflect-metadata"
import { DataSource } from "typeorm"
import { Block, File, Head, Line, Version } from "../../../typeorm-test"

export const AppDataSource = new DataSource({
    type: "postgres",
    host: "localhost",
    port: 5432,
    username: "ghost",
    password: "ghost",
    database: "ghostdb",
    synchronize: true,
    logging: false,
    entities: [Version, Line, File, Block, Head],
    migrations: [],
    subscribers: [],
})
