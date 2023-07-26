import { app } from "electron";

export enum PlatformName {
    win32 = "win32",
    linux = "linux",
    darwin = "darwin",
    darwinArm64 = "darwinArm64",
}

function getPlatformName(): PlatformName {
    const isDarwin = process.platform === "darwin";
    if (isDarwin && process.arch === "arm64") {
        return PlatformName.darwinArm64;
    }
    return process.platform as PlatformName;
}

export const isDev = process.env.NODE_ENV === "development";
export const platformName = getPlatformName();

export const appPath      = app.getAppPath()
export const userDataPath = app.getPath("userData")

// location of files included with extraResources during build process
export const extraResourcesPath = appPath.replace('app.asar', '');