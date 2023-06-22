// conditional import for database system
import "reflect-metadata"

import { app, BrowserWindow } from "electron"
import { AppDataSource } from "./backend/db/data-source"
import { GhostApp } from "./app/app"
import { Line, Version, File, Block, Head } from "../typeorm-test"

//import mongoose from "mongoose"
//import { FileModel, VersionHistoryModel, HeadModel, LineModel, Line, VersionReference } from "../mongo-test"

/*
async function main() {
    await mongoose.connect("mongodb://ghost-server:ghost-server-password@127.0.0.1:27017/ghostdb")

    async function createLine(): Promise<any> {
        const versionHistory = new VersionHistoryModel()
        versionHistory.versions.push({ timestamp: 0, isActive: true, content: "This is some content!" })
        await versionHistory.save()

        const line = new LineModel({ versionHistory: versionHistory })
        await line.save()

        return line
    }

    const file = new FileModel()
    const line = await createLine()
    file.lines.push(line)
    await file.save()

    const head = new HeadModel({ line: line, versionRef: { versionHistory: line.versionHistory, versionId: line.versionHistory.versions[0]._id } })
    await head.save()

    const heads = await HeadModel.find()
        .populate<{ line: Line }>("line")
        .populate<{ versionRef: VersionReference }>("versionRef.versionHistory")
        .orFail()
        .exec()

    heads.forEach(async head => {
        console.log(head.line)
        console.log(await head.getVersion())
        console.log("\n\n")
    })

    const files = await File.find().populate<Pick<PopulatedFile, "lines">>("lines.versionHistory").exec();
    
    files.forEach(file => {
        console.log(file.lines[0].versionHistory?.versions[0].content)
        //console.log(file.lines[0].ownerDocument())
        console.log()
    })

    GhostApp.start(app, BrowserWindow)
}

main().catch(error => { throw error })
*/


AppDataSource.initialize().then(async () => {

    let timestamp = Math.floor(Math.random() * 10000000)

    async function createLine(content: string): Promise<Line> {
        const line = new Line()
        await line.save()

        const version = new Version()
        version.line      = line
        version.timestamp = timestamp++
        version.isActive  = true
        version.content   = content
        await version.save()

        return line
    }

    const line1 = await createLine("TEXT!")
    const line2 = await createLine("More Text!")
    const line3 = await createLine("I am writing a lot!")

    const file = new File()
    await file.save()
    await file.appendLine(line1)
    await file.appendLine(line2)
    await file.appendLine(line3)

    async function createHead(block: Block, line: Line, version: Version): Promise<Head> {
        const head   = new Head()
        head.block   = block
        head.line    = line
        head.version = version

        await head.save()
        return head
    }

    async function createBlock(file: File, lines: Line[]): Promise<Block> {
        const block = new Block()
        block.file  = file
        block.lines = lines
        await block.save()

        for (const line of lines) {
            await createHead(block, line, (await line.getVersions())[0])
        }
        
        return block
    }

    const block1 = await createBlock(file, [line1])
    const block2 = await createBlock(file, [line2, line3])
    const block3 = await createBlock(file, [line1, line2, line3])

    const searchedFile = await File.repository.findOne({ where: { id: file.id }, relations: { lines: true, blocks: true } })
    console.log(searchedFile)

    console.log("---")
    await Promise.all(searchedFile.blocks.map(async block => console.log(await block.getVersions())))
    console.log("---")
    await Promise.all(searchedFile.blocks.map(async block => console.log(await block.getHeads())))

    GhostApp.start(app, BrowserWindow)
}).catch(error => { throw error })