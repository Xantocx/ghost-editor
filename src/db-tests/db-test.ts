import { Entity, JoinColumn, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn, Repository, FindOptionsWhereProperty } from "typeorm"
import { AppDataSource } from "../backend/db/data-source"


class Block {

    public readonly parent: Block | null
    public readonly origin: Block | null
    
    public readonly children: Block[]
    public readonly clones:   Block[]
}

class SubBlock {}

@Entity()
class Line {                                 // -> equivalent to LineNode

    public readonly blockId: number          // -> root block

    public readonly versionHistoryId: number         // -> global versions for a line, shared across all blocks

    public readonly previousId: number
    public readonly nextId:     number
}

class VersionHistory {
    public readonly lineId:     number
    public readonly versionIds: number[]
}

class Version {
    public readonly timestamp: number
    public readonly content:   string

    public readonly previousId: number
    public readonly nextId: number
}

class LineHistory {
    public readonly lineId: number
    public readonly headId: number
}