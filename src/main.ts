//import "electron-react-devtools"
import { config } from "dotenv"

import { app, BrowserWindow } from "electron"
import { GhostApp } from "./app/app"

import { prismaClient } from "./backend/vcs/db/client"

async function main() {
    config()
    GhostApp.start(app, BrowserWindow)
}

main()
    .then(async () => {
        await prismaClient.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prismaClient.$disconnect()
        process.exit(1)
    })