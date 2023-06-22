import { Repository, Entity, Index, Column, ManyToOne, OneToMany, ManyToMany, JoinTable, PrimaryGeneratedColumn, OneToOne, JoinColumn } from "typeorm";
import { AppDataSource } from "./src/backend/db/data-source"

function lazy<Value>(defaultValue: () => Value) {
    return function (target: any, key: string): void {
        let isReadonly: boolean           = false
        let untouched:  boolean           = true
        let value:      Value | undefined = target[key]
      
        const propertyDescriptor = Object.getOwnPropertyDescriptor(target, key)
        if (propertyDescriptor) { isReadonly = propertyDescriptor.writable === false }

        Object.defineProperty(target, key, {
            get: function () {
                if (untouched && value === undefined) {
                    value = defaultValue()
                    untouched = false
                }
                return value
            },
            set: function(newValue: Value) {
                if (isReadonly) { throw new Error("Cannot set readonly property!") }
                value = newValue
            },
            enumerable: true,
            configurable: true,
        });
    }
}

abstract class DatabaseEntity {

    public readonly repository: Repository<DatabaseEntity>

    @PrimaryGeneratedColumn()
    public readonly id: number

    public async save(): Promise<void> {
        await this.repository.save(this)
    }
}

@Entity()
export class Version extends DatabaseEntity {

    @lazy(() => AppDataSource.getRepository(Version))
    public static readonly repository: Repository<Version>

    public override readonly repository: Repository<Version> = Version.repository

    @ManyToOne(() => Line, line => line.versions)
    public line: Line

    @Column({ unique: true })
    @Index()
    public timestamp: number

    @Column()
    public isActive: boolean

    @Column("text")
    public content: string
}

@Entity()
export class Line extends DatabaseEntity {

    @lazy(() => AppDataSource.getRepository(Line))
    public static readonly repository: Repository<Line>

    public override readonly repository: Repository<Line> = Line.repository

    @ManyToOne(() => File, file => file.lines, { nullable: true })
    public file!: File

    @Column({ type: 'float', nullable: true })
    @Index()
    public order!: number

    @OneToMany(() => Version, version => version.line)
    public versions: Version[]

    @ManyToMany(() => Block, block => block.lines)
    public blocks: Block[]

    public async getVersions(): Promise<Version[]> {
        return await Version.repository.find({ where: { line: { id: this.id } }, order: { timestamp: "ASC" } })
    }
}

@Entity()
export class File extends DatabaseEntity {

    @lazy(() => AppDataSource.getRepository(File))
    public static readonly repository: Repository<File>

    public override readonly repository: Repository<File> = File.repository

    @OneToMany(() => Line, line => line.file)
    public lines: Line[]

    @OneToMany(() => Block, block => block.file)
    public blocks: Block[]

    private async normalizeLineOrder(): Promise<void> {
        const lines = await Line.repository.find({ where: { file: { id: this.id } }, order: { order: 'ASC' } })
        for (let i = 0; i < lines.length; i++) { lines[i].order = i + 1 }
        await Line.repository.save(lines);
    }

    public async getLineCount(): Promise<number> {
        return await Line.repository.count({ where: { file: { id: this.id } } });
    }

    public async getFirstLine(): Promise<Line> {
        return await Line.repository.findOne({ where: { file: { id: this.id } }, order: { order: 'ASC' } });
    }

    public async getLastLine(): Promise<Line> {
        return await Line.repository.findOne({ where: { file: { id: this.id } }, order: { order: 'DESC' } });
    }

    public async getLines(): Promise<Line[]> {
        return await Line.repository.find({ where: { file: { id: this.id } }, order: { order: "ASC" } })
    }

    public async insertLine(newLine: Line, relations?: { previousLine?: Line, nextLine?: Line }): Promise<void> {
        const previousLine = relations?.previousLine
        const nextLine     = relations?.nextLine
    
        let order: number

        if      (!previousLine && !nextLine) { order = 1 }
        else if (!nextLine)                  { order = previousLine.order + 1 } 
        else if (!previousLine)              { order = nextLine.order / 2 }
        else                                 { newLine.order = (previousLine.order + nextLine.order) / 2 }
    
        if (order === previousLine?.order || order === nextLine?.order) {
            this.normalizeLineOrder()
            await this.insertLine(newLine, relations)
        } else {
            newLine.file  = this
            newLine.order = order
            await newLine.save()
        }
    }

    public async prependLine(newLine: Line): Promise<void> {
        if (await this.getLineCount() === 0) {
            await this.insertLine(newLine)
        } else {
            const firstLine = await this.getFirstLine()
            await this.insertLine(newLine, { nextLine: firstLine });
        }
    }

    public async appendLine(newLine: Line): Promise<void> {
        if (await this.getLineCount() === 0) {
            await this.insertLine(newLine)
        } else {
            const lastLine = await this.getLastLine()
            await this.insertLine(newLine, { previousLine: lastLine });
        }
    }
}

@Entity()
export class Head extends DatabaseEntity {

    @lazy(() => AppDataSource.getRepository(Head))
    public static readonly repository: Repository<Head>

    public override readonly repository: Repository<Head> = Head.repository

    @ManyToOne(() => Block, block => block.heads)
    public block: Block

    @ManyToOne(() => Line)
    public line: Line

    @OneToOne(() => Version)
    @JoinColumn()
    public version: Version
}

@Entity()
export class Block extends DatabaseEntity {

    @lazy(() => AppDataSource.getRepository(Block))
    public static readonly repository: Repository<Block>

    public override readonly repository: Repository<Block> = Block.repository

    @ManyToOne(() => File, file => file.blocks)
    public file: File

    @ManyToMany(() => Line, line => line.blocks)
    @JoinTable()
    public lines: Line[]

    @OneToMany(() => Head, head => head.block)
    public heads: Head[]

    public async getVersions(): Promise<Version[]> {
        return await Version.repository.createQueryBuilder('version')
            .leftJoinAndSelect('version.line', 'line')
            .leftJoinAndSelect('line.blocks', 'block')
            .where('block.id = :id', { id: this.id })
            .orderBy('version.timestamp', 'ASC')
            .getMany();
    }

    public async getHeads(): Promise<Map<number, Version>> {
        const map = new Map<number, Version>()
        const heads = await Head.repository.find({ where: { block: { id: this.id } }, relations: { line: true, version: true } })
        heads.forEach(head => map.set(head.line.id, head.version))
        return map
    }
}