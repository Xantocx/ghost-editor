import { ipcRenderer } from "electron"
import { VCSResponse, VCSBlockId, VCSBlockInfo, VCSBlockRange, VCSBlockUpdate, VCSChildBlockInfo, VCSCopyBlockInfo, VCSFileId, VCSFileLoadingOptions, VCSRootBlockInfo, VCSSessionId, VCSTagInfo, VCSClient, VCSTagId, VCSSessionCreationRequest, VCSSessionRequest } from "../../provider"
import { AnyChange, ChangeSet, LineChange, MultiLineChange } from "../../data-types/change"
import ElectronVCSServer from "../servers/electron-server"

function invoke<Type>(channel: string, ...args: any): Promise<Type> {
    return ipcRenderer.invoke(channel, ...args)
}

const ElectronVCSClient: VCSClient = {

    createSession: function (request: VCSSessionCreationRequest): Promise<VCSResponse<VCSSessionId>> {
        return invoke(ElectronVCSServer.createSessionChannel, request)
    },

    closeSession: function (request: VCSSessionRequest<void>): Promise<VCSResponse<void>> {
        return invoke(ElectronVCSServer.closeSessionChannel, request)
    },

    waitForCurrentRequests: function (request: VCSSessionRequest<void>): Promise<VCSResponse<void>> {
        return invoke(ElectronVCSServer.waitForCurrentRequestsChannel, request)
    },

    loadFile: function (request: VCSSessionRequest<{ options: VCSFileLoadingOptions }>): Promise<VCSResponse<VCSRootBlockInfo>> {
        return invoke(ElectronVCSServer.loadFileChannel, request)
    },

    updateFilePath: function (request: VCSSessionRequest<{ fileId: VCSFileId, filePath: string }>): Promise<VCSResponse<VCSFileId>> {
        return invoke(ElectronVCSServer.updateFilePathChannel, request)
    },

    unloadFile: function (request: VCSSessionRequest<{ fileId: VCSFileId }>): Promise<VCSResponse<void>> {
        return invoke(ElectronVCSServer.unloadFileChannel, request)
    },

    getText: function (request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<string>> {
        return invoke(ElectronVCSServer.getTextChannel, request)
    },

    getRootText: function (request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<string>> {
        return invoke(ElectronVCSServer.getRootTextChannel, request)
    },

    lineChanged: function (request: VCSSessionRequest<{ blockId: VCSBlockId, change: LineChange }>): Promise<VCSResponse<VCSBlockId[]>> {
        return invoke(ElectronVCSServer.lineChangedChannel, request)
    },

    linesChanged: function (request: VCSSessionRequest<{ blockId: VCSBlockId, change: MultiLineChange }>): Promise<VCSResponse<VCSBlockId[]>> {
        return invoke(ElectronVCSServer.linesChangedChannel, request)
    },

    applyChange: function (request: VCSSessionRequest<{ blockId: VCSBlockId, change: AnyChange }>): Promise<VCSResponse<VCSBlockId[]>> {
        return invoke(ElectronVCSServer.applyChangeChannel, request)
    },

    applyChanges: function (request: VCSSessionRequest<{ blockId: VCSBlockId, changes: ChangeSet }>): Promise<VCSResponse<VCSBlockId[]>> {
        return invoke(ElectronVCSServer.applyChangesChannel, request)
    },
    
    copyBlock: function (request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSCopyBlockInfo>> {
        return invoke(ElectronVCSServer.copyBlockChannel, request)
    },

    createChild: function (request: VCSSessionRequest<{ parentBlockId: VCSBlockId, range: VCSBlockRange }>): Promise<VCSResponse<VCSChildBlockInfo>> {
        return invoke(ElectronVCSServer.createChildChannel, request)
    },

    deleteBlock: function (request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<void>> {
        return invoke(ElectronVCSServer.deleteBlockChannel, request)
    },

    getBlockInfo: function (request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSBlockInfo>> {
        return invoke(ElectronVCSServer.getBlockInfoChannel, request)
    },

    getChildrenInfo: function (request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSBlockInfo[]>> {
        return invoke(ElectronVCSServer.getChildrenInfoChannel, request)
    },

    updateBlock: function (request: VCSSessionRequest<{ blockId: VCSBlockId, update: VCSBlockUpdate }>): Promise<VCSResponse<void>> {
        return invoke(ElectronVCSServer.updateBlockChannel, request)
    },

    syncBlocks: function (request: VCSSessionRequest<{ source: VCSBlockId, target: VCSBlockId }>): Promise<VCSResponse<string>> {
        return invoke(ElectronVCSServer.syncBlocksChannel, request)
    },

    setBlockVersionIndex: function (request: VCSSessionRequest<{ blockId: VCSBlockId, versionIndex: number }>): Promise<VCSResponse<string>> {
        return invoke(ElectronVCSServer.setBlockVersionIndexChannel, request)
    },

    saveCurrentBlockVersion: function (request: VCSSessionRequest<{ blockId: VCSBlockId, name?: string, description?: string, codeForAi?: string }>): Promise<VCSResponse<VCSTagInfo>> {
        return invoke(ElectronVCSServer.saveCurrentBlockVersionChannel, request)
    },

    applyTag: function (request: VCSSessionRequest<{ tagId: VCSTagId, blockId: VCSBlockId }>): Promise<VCSResponse<VCSBlockInfo>> {
        return invoke(ElectronVCSServer.applyTagChannel, request)
    },

    getErrorHint: function (request: VCSSessionRequest<{ code: string, errorMessage: string }>): Promise<VCSResponse<string | null>> {
        return invoke(ElectronVCSServer.getErrorHintChannel, request)
    }
}

export default ElectronVCSClient