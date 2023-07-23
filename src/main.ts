//import "electron-react-devtools"
import { config } from "dotenv"

import { app, BrowserWindow } from "electron"
import { GhostApp } from "./app/app"

import { prismaClient } from "./backend/vcs/db/client"
import { TimestampProvider } from "./backend/vcs/core/metadata/timestamps"

async function main() {
    config()
    await TimestampProvider.setup()
    GhostApp.start(app, BrowserWindow)
}

main()
    .then(async () => {
        await TimestampProvider.flush()
        await prismaClient.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await TimestampProvider.flush()
        await prismaClient.$disconnect()
        process.exit(1)
    })