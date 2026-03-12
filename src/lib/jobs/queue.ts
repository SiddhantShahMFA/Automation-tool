import { prisma } from '@/lib/db';
import { Prisma } from '@/generated/prisma/client';
import { v4 as uuidv4 } from 'uuid';

export type JobType = 'generate_prd' | 'publish_notion' | 'generate_jira' | 'generate_plan';
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'retrying';

export async function enqueueJob(
    type: JobType,
    payload: Record<string, unknown>,
    options?: { prdDocumentId?: string; idempotencyKey?: string }
) {
    const idempotencyKey = options?.idempotencyKey || uuidv4();

    // Check for existing job with same idempotency key
    if (options?.idempotencyKey) {
        const existing = await prisma.backgroundJob.findUnique({
            where: { idempotencyKey },
        });
        if (existing && (existing.status === 'completed' || existing.status === 'running')) {
            return existing;
        }
    }

    return prisma.backgroundJob.create({
        data: {
            type,
            status: 'pending',
            payload: payload as unknown as Prisma.InputJsonValue,
            idempotencyKey,
            prdDocumentId: options?.prdDocumentId,
        },
    });
}

export async function claimNextJob(): Promise<ReturnType<typeof prisma.backgroundJob.findFirst> | null> {
    // Find oldest pending job
    const job = await prisma.backgroundJob.findFirst({
        where: { status: 'pending' },
        orderBy: { createdAt: 'asc' },
    });

    if (!job) return null;

    // Claim it by setting to running
    return prisma.backgroundJob.update({
        where: { id: job.id, status: 'pending' },
        data: { status: 'running', startedAt: new Date() },
    });
}

export async function completeJob(
    jobId: string,
    result: Record<string, unknown>
) {
    return prisma.backgroundJob.update({
        where: { id: jobId },
        data: {
            status: 'completed',
            result: result as unknown as Prisma.InputJsonValue,
            completedAt: new Date(),
        },
    });
}

export async function failJob(jobId: string, error: string) {
    const job = await prisma.backgroundJob.findUnique({ where: { id: jobId } });
    if (!job) return;

    if (job.retries < job.maxRetries) {
        return prisma.backgroundJob.update({
            where: { id: jobId },
            data: {
                status: 'pending',
                retries: job.retries + 1,
                error,
            },
        });
    }

    return prisma.backgroundJob.update({
        where: { id: jobId },
        data: {
            status: 'failed',
            error,
            completedAt: new Date(),
        },
    });
}

export async function getJobStatus(jobId: string) {
    return prisma.backgroundJob.findUnique({
        where: { id: jobId },
        select: {
            id: true,
            type: true,
            status: true,
            result: true,
            error: true,
            retries: true,
            createdAt: true,
            completedAt: true,
        },
    });
}
