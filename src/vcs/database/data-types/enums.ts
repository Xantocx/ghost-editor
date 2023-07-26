// This file is for convenience to provide enums mapping to sqlite database values. Postgres supports those natively, but sqlite requires this mapping.
// The definitions are taken over from Prisma's generated code for Postgres to allow for interoperatability.

export enum BlockType {
    ROOT   = 'ROOT',
    INLINE = 'INLINE',
    CLONE  = 'CLONE'
}

export enum LineType {
    ORIGINAL = 'ORIGINAL',
    INSERTED = 'INSERTED'
}

export enum VersionType {
    IMPORTED      = 'IMPORTED',
    PRE_INSERTION = 'PRE_INSERTION',
    INSERTION     = 'INSERTION',
    CLONE         = 'CLONE',
    CHANGE        = 'CHANGE',
    DELETION      = 'DELETION'
}

/*
export let BlockType: {
    ROOT:   'ROOT',
    INLINE: 'INLINE',
    CLONE:  'CLONE'
};
export type BlockType = (typeof BlockType)[keyof typeof BlockType]

export let LineType: {
    ORIGINAL: 'ORIGINAL',
    INSERTED: 'INSERTED'
};
export type LineType = (typeof LineType)[keyof typeof LineType]

export let VersionType: {
    IMPORTED:      'IMPORTED',
    PRE_INSERTION: 'PRE_INSERTION',
    INSERTION:     'INSERTION',
    CLONE:         'CLONE',
    CHANGE:        'CHANGE',
    DELETION:      'DELETION'
};
export type VersionType = (typeof VersionType)[keyof typeof VersionType]
*/