import { BlockType } from "@prisma/client";
import { GetResult } from "@prisma/client/runtime";
import { VCSFileId, VCSFileData } from "../../../app/components/vcs/vcs-rework";
import { ISessionFile, NewFileInfo, Session } from "../db/utilities";
import { Block } from "./block";
import { Line, LineNode } from "./line";
import { Tag } from "./tag";
import { LineNodeVersion, LineVersion } from "./version";

export class File implements ISessionFile {
    id: number;
}

export class InMemorySession extends Session<File, LineNode, LineNodeVersion, Block, Tag> {

    protected createSessionFile(filePath: string, eol: string, content?: string): Promise<NewFileInfo<File, LineNode, LineNodeVersion, Block>> {
        throw new Error("Method not implemented.");
    }

    protected getRootSessionBlockFor(filePath: string): Promise<Block> {
        throw new Error("Method not implemented.");
    }

    protected getSessionBlockFrom(block: GetResult<{ id: number; blockId: string; fileId: number; type: BlockType; headListId: number; parentId: number; originId: number; }, unknown> & {}): Promise<Block> {
        throw new Error("Method not implemented.");
    }

    protected getSessionBlockFor(blockId: string): Promise<Block> {
        throw new Error("Method not implemented.");
    }

    protected getSessionTagFrom(tag: GetResult<{ id: number; tagId: string; blockId: number; name: string; timestamp: number; code: string; }, unknown> & {}): Promise<Tag> {
        throw new Error("Method not implemented.");
    }

    protected getSessionTagFor(tagId: string): Promise<Tag> {
        throw new Error("Method not implemented.");
    }

    protected deleteSessionBlock(block: Block): Promise<void> {
        throw new Error("Method not implemented.");
    }

    public getFileData(fileId: VCSFileId): Promise<VCSFileData> {
        throw new Error("Method not implemented.");
    }

}