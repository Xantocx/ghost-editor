import { ipcRenderer } from "electron"
import { VCSResponse, VCSBlockId, VCSBlockInfo, VCSBlockRange, VCSBlockUpdate, VCSChildBlockInfo, VCSCopyBlockInfo, VCSFileId, VCSFileLoadingOptions, VCSRootBlockInfo, VCSSessionId, VCSTagInfo, VCSClient, VCSTagId, VCSSessionCreationRequest, VCSSessionRequest } from "../vcs-rework"
import { ElectronVCSServer } from "../servers/electron-server"
import { AnyChange, ChangeSet, LineChange, MultiLineChange } from "../../data/change"

function invoke<Type>(channel: string, ...args: any): Promise<Type> {
    return ipcRenderer.invoke(channel, ...args)
}

export const ElectronVCSClient: VCSClient = {

    createSession: async function (request: VCSSessionCreationRequest): Promise<VCSResponse<VCSSessionId>> {
        return await invoke(ElectronVCSServer.createSessionChannel, request)
    },

    closeSession: async function (request: VCSSessionRequest<void>): Promise<VCSResponse<void>> {
        return await invoke(ElectronVCSServer.closeSessionChannel, request)
    },

    waitForCurrentRequests: async function (request: VCSSessionRequest<void>): Promise<VCSResponse<void>> {
        return await invoke(ElectronVCSServer.waitForCurrentRequestsChannel, request)
    },

    loadFile: async function (request: VCSSessionRequest<{ options: VCSFileLoadingOptions }>): Promise<VCSResponse<VCSRootBlockInfo>> {
        return await invoke(ElectronVCSServer.loadFileChannel, request)
    },

    updateFilePath: async function (request: VCSSessionRequest<{ fileId: VCSFileId, filePath: string }>): Promise<VCSResponse<VCSFileId>> {
        return await invoke(ElectronVCSServer.updateFilePathChannel, request)
    },

    unloadFile: async function (request: VCSSessionRequest<{ fileId: VCSFileId }>): Promise<VCSResponse<void>> {
        return await invoke(ElectronVCSServer.unloadFileChannel, request)
    },

    getText: async function (request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<string>> {
        return await invoke(ElectronVCSServer.getTextChannel, request)
    },

    getRootText: async function (request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<string>> {
        return await invoke(ElectronVCSServer.getRootTextChannel, request)
    },

    lineChanged: async function (request: VCSSessionRequest<{ blockId: VCSBlockId, change: LineChange }>): Promise<VCSResponse<VCSBlockId[]>> {
        return await invoke(ElectronVCSServer.lineChangedChannel, request)
    },

    linesChanged: async function (request: VCSSessionRequest<{ blockId: VCSBlockId, change: MultiLineChange }>): Promise<VCSResponse<VCSBlockId[]>> {
        return await invoke(ElectronVCSServer.linesChangedChannel, request)
    },

    applyChange: async function (request: VCSSessionRequest<{ blockId: VCSBlockId, change: AnyChange }>): Promise<VCSResponse<VCSBlockId[]>> {
        return await invoke(ElectronVCSServer.applyChangeChannel, request)
    },

    applyChanges: async function (request: VCSSessionRequest<{ blockId: VCSBlockId, changes: ChangeSet }>): Promise<VCSResponse<VCSBlockId[]>> {
        return await invoke(ElectronVCSServer.applyChangesChannel, request)
    },
    
    copyBlock: async function (request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSCopyBlockInfo>> {
        return await invoke(ElectronVCSServer.copyBlockChannel, request)
    },

    createChild: async function (request: VCSSessionRequest<{ parentBlockId: VCSBlockId, range: VCSBlockRange }>): Promise<VCSResponse<VCSChildBlockInfo>> {
        return await invoke(ElectronVCSServer.createChildChannel, request)
    },

    deleteBlock: async function (request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<void>> {
        return await invoke(ElectronVCSServer.deleteBlockChannel, request)
    },

    getBlockInfo: async function (request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSBlockInfo>> {
        return await invoke(ElectronVCSServer.getBlockInfoChannel, request)
    },

    getChildrenInfo: async function (request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSBlockInfo[]>> {
        return await invoke(ElectronVCSServer.getChildrenInfoChannel, request)
    },

    updateBlock: async function (request: VCSSessionRequest<{ blockId: VCSBlockId, update: VCSBlockUpdate }>): Promise<VCSResponse<void>> {
        return await invoke(ElectronVCSServer.updateBlockChannel, request)
    },

    setBlockVersionIndex: async function (request: VCSSessionRequest<{ blockId: VCSBlockId, versionIndex: number }>): Promise<VCSResponse<string>> {
        return await invoke(ElectronVCSServer.setBlockVersionIndexChannel, request)
    },

    saveCurrentBlockVersion: async function (request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSTagInfo>> {
        return await invoke(ElectronVCSServer.saveCurrentBlockVersionChannel, request)
    },

    applyTag: async function (request: VCSSessionRequest<{ tagId: VCSTagId, blockId: VCSBlockId }>): Promise<VCSResponse<VCSBlockInfo>> {
        return await invoke(ElectronVCSServer.applyTagChannel, request)
    },

    getErrorHint: async function (request: VCSSessionRequest<{ code: string, errorMessage: string }>): Promise<VCSResponse<string | null>> {
        return await invoke(ElectronVCSServer.getErrorHintChannel, request)
    }
}