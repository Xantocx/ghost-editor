import fs from "fs"
import { prismaClient } from "./client"
import { databasePath, databaseUrl, latestMigration } from "./utils/constants"
import log from "electron-log"
import path from "path"
import { Migration } from "./data-types/prisma"
import { runPrismaCommand } from "./utils/prisma-commands"
import { extraResourcesPath } from "../../utils/environment"

export async function configureDatabase(): Promise<void> {

    const databaseExists    = fs.existsSync(databasePath)
    let   migrationRequired = !databaseExists

    if (databaseExists) {
        try {
            const latest: Migration[] = await prismaClient.$queryRaw`select * from _prisma_migrations order by finished_at`;
            migrationRequired = latest[latest.length-1]?.migration_name !== latestMigration;
        } catch (error) {
            log.error(error)
            migrationRequired = true
        }
    } else {
        // NOTE: Probably not needed, but if prisma struggles, then touch file as shown below:
        // fs.closeSync(fs.openSync(dbPath, 'w'));
    }

    if (migrationRequired) { 
        try {
            const schemaPath = path.join(extraResourcesPath, 'prisma', "schema.prisma");

            log.info(`Needs a migration. Running prisma migrate with schema path ${schemaPath}.`);
            log.info(`Migrating to ${databaseUrl}.`)
      
            // first create or migrate the database! If you were deploying prisma to a cloud service, this migrate deploy
            // command you would run as part of your CI/CD deployment. Since this is an electron app, it just needs
            // to run every time the production app is started. That way if the user updates the app and the schema has
            // changed, it will transparently migrate their DB.
            await runPrismaCommand({ command: ["migrate", "deploy", "--schema", schemaPath], databaseUrl });

            log.info("Migration done.")
      
            // seed (not needed in my case)
            // log.info("Seeding...");
            // await seed(prismaClient);
        } catch (error) {
            log.error(error);
            process.exit(1);
        }
    } else {
        log.info("No migration needed.");
    }
}