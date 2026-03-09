import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://siddhantshah@localhost:5432/prd_autopilot';

const globalForPrisma = globalThis as unknown as {
    prisma2: InstanceType<typeof PrismaClient> | undefined;
};

function createPrismaClient() {
    const adapter = new PrismaPg({ connectionString });
    return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma2 ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma2 = prisma;
}
