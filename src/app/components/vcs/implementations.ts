// ELECTRON VCS SERVER ----------------------------------------------------------------------------------
import * as electronServer from "./servers/electron-server";
import * as electronClient from "./clients/electron-client";

export const ElectronVCSServer = electronServer.ElectronVCSServer
export const ElectronVCSClient = electronClient.ElectronVCSClient

// LOCAL GHOST VCS SERVER --------------------------------------------------------------------------------
import * as localGhostVCSServer from "./servers/local-ghost-server"

export const LocalGhostVCSServer = localGhostVCSServer.LocalGhostVCSServer
export const LocalGhostVCSClient = electronClient.ElectronVCSClient