import { app, BrowserWindow } from "electron"
import { GhostApp } from "./app/app"

import { prismaClient } from "./backend/vcs/db/client"
import { FileProxy, BlockProxy, LineProxy, VersionProxy } from "./backend/vcs/db/types"

async function main() {
    const { file, rootBlock }  = await FileProxy.create(undefined, "\n", "This is an amazing test string!\nI will use it to create a file in my database!\nBelieve it or not!")
    const lines = await prismaClient.line.findMany({
        where:   { fileId: file.id },
        orderBy: { order: "asc" },
        include: { versions: true }
    })

    const block = await BlockProxy.create("INSERTED " + Math.floor(Math.random() * 10000000), file)
    
    const line1 = new LineProxy(lines[1].id)
    const line2 = new LineProxy(lines[2].id)
    
    await file.appendLine("I APPENDED A LINE!")
    await file.prependLine("I PREPRENDED A LINE!")
    await file.insertLine("REGULAR INSERTION AS WELL??????", { previous: line1, next: line2 })
    await file.appendLine("AND ANOTHER ONEEEE!")
    await file.prependLine("LITERAL MAGIC!")

    const headInfo = new Map([[block, new VersionProxy(lines[1].versions[1].id)]])
    //line1.addBlock(block, lines[1].versions[1])
    line1.addBlocks(headInfo)

    let fullFile = await prismaClient.file.findUniqueOrThrow({
        where: {
            id: file.id
        },
        include: {
            lines: {
                include: {
                    blocks: true,
                    versions: {
                        orderBy: {
                            timestamp: "asc"
                        }
                    }
                },
                orderBy: {
                    order: "asc"
                }
            },
            blocks: {
                include: {
                    lines: true,
                    heads: true,
                }
            }
        }
    })

    console.log(fullFile)
    console.log("------------------------------")
    console.log(fullFile!.lines)
    console.log("------------------------------")
    fullFile!.lines.forEach(line => console.log(line.versions))
    console.log("------------------------------")
    console.log(fullFile!.blocks[0])
    console.log("------------------------------")
    console.log(fullFile!.blocks[1])

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