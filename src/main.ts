// conditional import for database system
//import "reflect-metadata"

import { app, BrowserWindow } from "electron"
//import { AppDataSource } from "./backend/db/data-source"
//import { User } from "./backend/db/entity/User"
import { GhostApp } from "./app/app"

import mongoose from "mongoose"
import { File, VersionHistory, Head, PopulatedFile, PopulatedHead, PopulatedLine } from "../mongo-test"

async function main() {
    await mongoose.connect("mongodb://ghost-server:ghost-server-password@127.0.0.1:27017/ghostdb")

    async function createVersionHistory(): Promise<any> {
        const versionHistory = new VersionHistory()
        versionHistory.versions.push({ timestamp: 0, isActive: true, content: "This is some content!" })
        await versionHistory.save()
        return versionHistory
    }

    const file = new File()
    const versionHistory = await createVersionHistory()
    file.lines.push({ versionHistory: versionHistory._id })
    await file.save()

    const head = new Head({ file: file._id, line: file.lines[0]._id, version: versionHistory.versions[0]._id })
    await head.save()

    const heads = await Head.find().populate<Pick<PopulatedHead, "file">>("file.lines")

    heads.forEach(head => {
        const file           = head.file as PopulatedFile
        const lines          = file.lines
        const line           = lines.id(head.lineId).populate<PopulatedLine, >
        const versionHistory = line.versionHistory
        const version        = file.versionHistory as 

        console.log(lines)
        console.log()
    })

    /*
    const files = await File.find().populate<Pick<PopulatedFile, "lines">>("lines.versionHistory").exec();
    
    files.forEach(file => {
        console.log(file.lines[0].versionHistory?.versions[0].content)
        //console.log(file.lines[0].ownerDocument())
        console.log()
    })
    */

    GhostApp.start(app, BrowserWindow)
}

main().catch(error => { throw error })


/*
AppDataSource.initialize().then(async () => {

    const userRepository = AppDataSource.getRepository(User)

    const user = new User()
    user.firstName = "Timber"
    user.lastName = "Saw"
    user.age = 25
    await userRepository.save(user)

    console.log(user)

    const allUsers = await userRepository.find()
    const firstUser = await userRepository.findOneBy({
        id: 1,
    }) // find by id
    const timber = await userRepository.findOneBy({
        firstName: "Timber",
        lastName: "Saw",
    }) // find by firstName and lastName

    console.log(allUsers)
    console.log(firstUser)
    console.log(timber)

    //await userRepository.remove(timber)

    GhostApp.start(app, BrowserWindow)
}).catch(error => { throw error })
*/