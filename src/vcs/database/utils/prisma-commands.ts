import log from "electron-log";
import path from "path";
import {fork} from "child_process";
import { schemaEnginePath, queryEnginePath } from "./constants";
import { appPath } from "../../../utils/environment";

// HUGE thanks to Ayron Wohletz for providing a template repository I used to setup this mess.
// See https://github.com/awohletz/electron-prisma-trpc-example?ref=funtoimagine.com

export async function runPrismaCommand({ command, databaseUrl }: { command: string[]; databaseUrl: string; }): Promise<number> {

    log.info("Migration engine path", schemaEnginePath);
    log.info("Query engine path", queryEnginePath);

    // Currently we don't have any direct method to invoke prisma migration programatically.
    // As a workaround, we spawn migration script as a child process and wait for its completion.
    // Please also refer to the following GitHub issue: https://github.com/prisma/prisma/issues/4703
    try {
        const exitCode = await new Promise((resolve) => {
            const prismaPath = path.resolve(appPath, "node_modules/prisma/build/index.js");
            log.info("Prisma path", prismaPath);

            const child = fork(
                prismaPath,
                command,
                {
                    env: {
                        ...process.env,
                        DATABASE_URL: databaseUrl,
                        PRISMA_SCHEMA_ENGINE_BINARY: schemaEnginePath,
                        PRISMA_QUERY_ENGINE_LIBRARY: queryEnginePath,
                    },
                    stdio: "pipe"
                }
            );

            child.on("message", msg => {
                log.info(msg);
            })

            child.on("error", err => {
                log.error("Child process got error:", err);
            });

            child.on("close", (code) => {
                resolve(code);
            })

            child.stdout?.on('data',function(data) {
                log.info("prisma: ", data.toString());
            });

            child.stderr?.on('data',function(data) {
                log.error("prisma: ", data.toString());
            });
        });

        if (exitCode !== 0) throw Error(`command ${command} failed with exit code ${exitCode}`);

        return exitCode;
    } catch (error) {
        log.error(error);
        throw error;
    }
}
