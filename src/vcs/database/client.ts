import { PrismaClient } from '@prisma/client'
import { databaseUrl } from './utils/constants';

export const prismaClient = new PrismaClient({
    log: ['info', 'warn', 'error'],
    datasources: {
        db: {
            url: databaseUrl
        }
    },
});