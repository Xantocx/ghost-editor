// conditional import for database system
import "reflect-metadata"

import { app, BrowserWindow } from "electron"
import { AppDataSource } from "./backend/db/data-source"
import { User } from "./backend/db/entity/User"
import { GhostApp } from "./app/app"

AppDataSource.initialize().then(async () => {

    /*
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
    */

    GhostApp.start(app, BrowserWindow)
}).catch(error => { throw error })