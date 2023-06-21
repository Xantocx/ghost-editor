abstract class DatabaseEntity {

    public static readonly repositoryExpansion = {
        async findById<T>(id: number): Promise<T | null> {
            return this.createQueryBuilder("entity")
                .where("entity.databaseId = :id", { id })
                .getOne()
        },
    }

    @PrimaryGeneratedColumn()
    public readonly databaseId: number

    public async save(): Promise<void> {
        
    }
}

type DatabaseEntityConstructor<T extends DatabaseEntity> = { new (): T };

interface DatabaseEntityRepository<T extends DatabaseEntity> extends Repository<T> {
    findById(id: number): Promise<T | null>
}

class DatabaseProxy<T extends DatabaseEntity> {

    private static readonly proxyCache = new Map<DatabaseEntityConstructor<any>, DatabaseProxy<any>>()

    public static getProxy<T extends DatabaseEntity>(type: DatabaseEntityConstructor<T>): DatabaseProxy<T> {
        if (this.proxyCache.has(type)) {
            return this.proxyCache.get(type)!
        } else {
            const repository = (AppDataSource.getRepository<T>(type).extend(DatabaseEntity.repositoryExpansion) as DatabaseEntityRepository<T>)!
            const proxy = new DatabaseProxy(repository)
            this.proxyCache.set(type, proxy)
            return proxy
        }
    }

    private readonly repository: DatabaseEntityRepository<T>
    private readonly cache = new Map<number, T>()

    public constructor(repository: DatabaseEntityRepository<T>) {
        this.repository = repository
    }

    public async registerId(id: number): Promise<T | null> {
        if (this.cache.has(id)) { return this.cache.get(id) }

        const value = await this.repository.findById(id)
        if (value !== null) { this.cache.set(id, value) }
        return value
    }

    // WARNING: This function assumes the object provided is the most recent version! So if the database is more up-to-date than the provided version, this info will be lost once the object is saved!
    public registerValue(value: T): void {
        if (this.cache.has(value.databaseId)) {
            if (this.cache.get(value.databaseId) !== value) { throw new Error("Provided value is of different identify than cached value! This is illegal as this would break object individuality!") }
            else                                            { return }
        }

        this.cache.set(value.databaseId, value)
    }

    public async getValueForId(id: number): Promise<T | null> {
        if (this.cache.has(id)) { return this.cache.get(id) }
        else                    { return await this.registerId(id) }
    }
}


function UniqueMapping<Target, Value extends DatabaseEntity>(type: DatabaseEntityConstructor<Value>, idKey: keyof Target) {
    return function (target: Target, key: string) {
        const proxy = DatabaseProxy.getProxy(type)

        const getter = async function(): Promise<Value | null> {
            const id = target[idKey]
            if (id !== null && id !== undefined) {
                if (typeof id !== "number") { throw new Error("Type of value for id key is not number!") }
                return await proxy.getValueForId(id)
            } else {
                return null
            }
        };
    
        const setter = function (newValue: Value | undefined) {
            target[idKey] = newValue?.databaseId;
        };
    
        // Redefine the property with getter and setter
        Object.defineProperty(target, key, {
            get: getter,
            set: setter,
            enumerable: true,
            configurable: true,
        });
    }
}








function Cached<Target, Value extends DatabaseEntity>(type: DatabaseEntityConstructor<Value>) {
    return function(target: Target, key: string) {
        const value: Value | undefined = target[key];
        if (value !== undefined) { this.register(value) }
    
        let   id: number = value?.databaseId
        const proxy      = DatabaseProxy.getProxy(type)

        const getter = async function(): Promise<Value | undefined> {
            return id !== undefined ? await proxy.getValueForId(id) : undefined;
        };
    
        const setter = function (newValue: Value | undefined) {
            id = newValue?.databaseId;
        };
    
        // Redefine the property with getter and setter
        Object.defineProperty(target, key, {
            get: getter,
            set: setter,
            enumerable: true,
            configurable: true,
        });
    }
}

function CachedCollection<Target, Value extends DatabaseEntity>(type: DatabaseEntityConstructor<Value>) {
    return function(target: Target, key: string) {
        const values: Value[] | undefined = target[key];
        let   ids:    number[]            = []

        if (values !== undefined) { 
            values.map(value => {
                this.register(value)
                return value.databaseId
            })
        }
    
        const proxy = DatabaseProxy.getProxy(type)

        const getter = async function(): Promise<Value | undefined> {
            return ids.map(id => proxy.getValueForId(id))
        };
    
        const setter = function (newValue: Value | undefined) {
            id = newValue?.databaseId;
        };
    
        // Redefine the property with getter and setter
        Object.defineProperty(target, key, {
            get: getter,
            set: setter,
            enumerable: true,
            configurable: true,
        });
    }
}


@Entity()
class DatabaseNode extends DatabaseEntity {

    @Cached(DatabaseNodeVersion)
    @OneToMany(() => DatabaseNodeVersion, version => version.node)
    public readonly versions: DatabaseNodeVersion[]
}

@Entity()
class DatabaseNodeVersion extends DatabaseEntity {

    @Cached(DatabaseNode)
    @ManyToOne(() => DatabaseNode, node => node.versions)
    public readonly node: DatabaseNode
}