import { createHash, randomUUID } from 'crypto';

import { prisma } from '@/lib/db';
import { Prisma } from '@/generated/prisma/client';
import type { NormalizedRequirementInput, PrdContent, TimelineEntry } from '@/lib/prd/types';

type TxClient = Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>;
type CanonicalSchemaStatus = { ready: boolean; missingTables: string[] };

const CANONICAL_TABLES = [
    'prd_requirements',
    'requirement_versions',
    'requirement_changes',
    'jira_tickets',
    'jira_ticket_requirement_links',
    'artifact_versions',
] as const;

export const CANONICAL_SCHEMA_REQUIRED_MESSAGE =
    'Database migration required for canonical history features. Run `npm run prisma:migrate` and reload the app.';

export class CanonicalSchemaNotReadyError extends Error {
    missingTables: string[];

    constructor(missingTables: string[]) {
        super(CANONICAL_SCHEMA_REQUIRED_MESSAGE);
        this.name = 'CanonicalSchemaNotReadyError';
        this.missingTables = missingTables;
    }
}

export function isCanonicalSchemaNotReadyError(error: unknown): error is CanonicalSchemaNotReadyError {
    return error instanceof CanonicalSchemaNotReadyError;
}

function normalizeText(value: string | null | undefined): string {
    return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeDisplayId(value: string | null | undefined): string {
    return normalizeText(value).replace(/[^a-z0-9]/g, '');
}

function buildStableKey(input: NormalizedRequirementInput): string {
    const fingerprint = [
        input.category,
        normalizeDisplayId(input.displayId),
        normalizeText(input.title),
    ].join('|');
    return `req_${createHash('sha1').update(fingerprint).digest('hex').slice(0, 12)}_${randomUUID().slice(0, 8)}`;
}

function buildSnapshot(input: NormalizedRequirementInput) {
    return {
        category: input.category,
        displayId: input.displayId,
        title: input.title,
        description: input.description,
        priority: input.priority,
    };
}

function contentHash(input: NormalizedRequirementInput): string {
    return createHash('sha1').update(JSON.stringify(buildSnapshot(input))).digest('hex');
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
}

export async function getCanonicalSchemaStatus(): Promise<CanonicalSchemaStatus> {
    const rows = await prisma.$queryRawUnsafe<Array<{ table_name: string; regclass: string | null }>>(
        `SELECT required.table_name, to_regclass('public.' || required.table_name)::text AS regclass
         FROM (VALUES ${CANONICAL_TABLES.map((table) => `('${table}')`).join(', ')}) AS required(table_name)`
    );

    const missingTables = rows
        .filter((row) => !row.regclass)
        .map((row) => row.table_name);

    return {
        ready: missingTables.length === 0,
        missingTables,
    };
}

export async function assertCanonicalSchemaReady() {
    const status = await getCanonicalSchemaStatus();
    if (!status.ready) {
        throw new CanonicalSchemaNotReadyError(status.missingTables);
    }
    return status;
}

function valuesDiffer(a: NormalizedRequirementInput, b: NormalizedRequirementInput): boolean {
    return contentHash(a) !== contentHash(b);
}

export function normalizePrdRequirements(prdContent: PrdContent): NormalizedRequirementInput[] {
    const functional = (prdContent.functionalRequirements || []).map((requirement) => ({
        category: 'functional' as const,
        displayId: requirement.id || null,
        title: requirement.title?.trim() || 'Untitled Functional Requirement',
        description: requirement.description?.trim() || '',
        priority: requirement.priority || null,
    }));

    const nonFunctional = (prdContent.nonFunctionalRequirements || []).map((requirement) => ({
        category: 'non_functional' as const,
        displayId: requirement.id || null,
        title: requirement.title?.trim() || 'Untitled Non-Functional Requirement',
        description: requirement.description?.trim() || '',
        priority: requirement.priority || null,
    }));

    return [...functional, ...nonFunctional];
}

function mapArtifactType(type: string): string {
    if (type === 'plan_md') return 'plan_md';
    if (type === 'jira_tickets') return 'jira_delta';
    if (type === 'prd_draft') return 'prd_content';
    return type;
}

function buildChangeSummary(changeType: 'ADD' | 'UPDATE' | 'REMOVE', title: string): string {
    if (changeType === 'ADD') return `Added requirement "${title}"`;
    if (changeType === 'REMOVE') return `Removed requirement "${title}"`;
    return `Updated requirement "${title}"`;
}

function buildRequirementMatcher(
    existingRequirements: Array<{
        id: string;
        category: string;
        displayId: string | null;
        title: string;
        description: string;
        priority: string | null;
        status: string;
        versions: Array<{ id: string }>;
    }>
) {
    return (input: NormalizedRequirementInput, consumedIds: Set<string>) =>
        existingRequirements.find((requirement) => {
            if (consumedIds.has(requirement.id)) return false;
            if (requirement.category !== input.category) return false;

            const inputDisplayId = normalizeDisplayId(input.displayId);
            const requirementDisplayId = normalizeDisplayId(requirement.displayId);
            if (inputDisplayId && requirementDisplayId && inputDisplayId === requirementDisplayId) {
                return true;
            }

            return normalizeText(requirement.title) === normalizeText(input.title);
        }) || null;
}

async function createRequirementVersion(
    tx: TxClient,
    requirementId: string,
    prdVersion: number,
    input: NormalizedRequirementInput
) {
    return tx.requirementVersion.create({
        data: {
            requirementId,
            prdVersion,
            title: input.title,
            description: input.description,
            priority: input.priority,
            snapshotJson: toJsonValue(buildSnapshot(input)),
        },
    });
}

async function createRequirementChange(
    tx: TxClient,
    params: {
        prdDocumentId: string;
        requirementId: string;
        prdVersion: number;
        changeType: 'ADD' | 'UPDATE' | 'REMOVE';
        summary: string;
        oldVersionId?: string | null;
        newVersionId?: string | null;
    }
) {
    return tx.requirementChange.create({
        data: {
            prdDocumentId: params.prdDocumentId,
            requirementId: params.requirementId,
            prdVersion: params.prdVersion,
            changeType: params.changeType,
            summary: params.summary,
            oldVersionId: params.oldVersionId || null,
            newVersionId: params.newVersionId || null,
        },
    });
}

export async function createArtifactVersion(params: {
    prdDocumentId: string;
    type: string;
    prdVersion: number;
    status?: string;
    payloadJson: Record<string, unknown>;
    sourceArtifactId?: string | null;
}) {
    await assertCanonicalSchemaReady();

    return prisma.artifactVersion.create({
        data: {
            prdDocumentId: params.prdDocumentId,
            type: params.type,
            prdVersion: params.prdVersion,
            status: params.status || 'draft',
            payloadJson: toJsonValue(params.payloadJson),
            sourceArtifactId: params.sourceArtifactId || null,
        },
    });
}

export async function ensureCanonicalPrdState(prdDocumentId: string) {
    const schemaStatus = await getCanonicalSchemaStatus();
    if (!schemaStatus.ready) {
        return {
            ...schemaStatus,
            hydrated: false,
        };
    }

    const existingCount = await prisma.prdRequirement.count({
        where: { prdDocumentId },
    });

    if (existingCount > 0) {
        return {
            ...schemaStatus,
            hydrated: false,
        };
    }

    const prdDocument = await prisma.prdDocument.findUnique({
        where: { id: prdDocumentId },
        include: {
            generatedArtifacts: true,
            updateLogs: true,
        },
    });

    if (!prdDocument) {
        throw new Error('PRD document not found for canonical backfill');
    }

    const prdContent = prdDocument.contentJson as PrdContent | null;
    if (!prdContent) {
        return {
            ...schemaStatus,
            hydrated: false,
        };
    }

    await prisma.$transaction(async (tx) => {
        const normalizedRequirements = normalizePrdRequirements(prdContent);

        for (const requirement of normalizedRequirements) {
            const createdRequirement = await tx.prdRequirement.create({
                data: {
                    prdDocumentId,
                    stableKey: buildStableKey(requirement),
                    category: requirement.category,
                    displayId: requirement.displayId,
                    title: requirement.title,
                    description: requirement.description,
                    priority: requirement.priority,
                    status: 'active',
                },
            });

            const version = await createRequirementVersion(tx, createdRequirement.id, prdDocument.version, requirement);

            await createRequirementChange(tx, {
                prdDocumentId,
                requirementId: createdRequirement.id,
                prdVersion: prdDocument.version,
                changeType: 'ADD',
                summary: `Backfilled existing requirement "${requirement.title}"`,
                newVersionId: version.id,
            });
        }

        const artifactVersions = await tx.artifactVersion.count({
            where: { prdDocumentId },
        });

        if (artifactVersions === 0) {
            await tx.artifactVersion.create({
                data: {
                    prdDocumentId,
                    type: 'prd_content',
                    prdVersion: prdDocument.version,
                    status: 'backfilled',
                    payloadJson: toJsonValue({
                        prdContent,
                        source: 'contentJson',
                    }),
                },
            });

            for (const artifact of prdDocument.generatedArtifacts) {
                await tx.artifactVersion.create({
                    data: {
                        prdDocumentId,
                        type: mapArtifactType(artifact.type),
                        prdVersion: prdDocument.version,
                        status: 'backfilled',
                        sourceArtifactId: artifact.id,
                        payloadJson: toJsonValue(artifact.contentJson),
                    },
                });
            }
        }

        const existingTicketCount = await tx.jiraTicket.count({
            where: { prdDocumentId },
        });

        if (existingTicketCount === 0) {
            const jiraArtifact = prdDocument.generatedArtifacts.find((artifact) => artifact.type === 'jira_tickets');
            const jiraContent = jiraArtifact?.contentJson as { tickets?: Array<Record<string, unknown>> } | undefined;
            const tickets = Array.isArray(jiraContent?.tickets)
                ? jiraContent?.tickets || []
                : Array.isArray(jiraArtifact?.contentJson)
                    ? (jiraArtifact?.contentJson as Array<Record<string, unknown>>)
                    : [];

            const requirements = await tx.prdRequirement.findMany({
                where: { prdDocumentId },
            });

            for (const ticket of tickets) {
                const createdTicket = await tx.jiraTicket.create({
                    data: {
                        prdDocumentId,
                        projectKey: null,
                        issueKey: typeof ticket.issueKey === 'string' ? ticket.issueKey : null,
                        type: typeof ticket.type === 'string' ? ticket.type : 'Story',
                        summary: typeof ticket.summary === 'string' ? ticket.summary : 'Untitled Ticket',
                        description: typeof ticket.description === 'string' ? ticket.description : '',
                        status: typeof ticket.issueKey === 'string' ? 'published' : 'draft',
                        lastAction: typeof ticket.action === 'string' ? ticket.action : 'CREATE',
                    },
                });

                const matchingRequirement = requirements.find((requirement) =>
                    normalizeText(ticket.summary as string).includes(normalizeText(requirement.title))
                );

                if (matchingRequirement) {
                    await tx.jiraTicketRequirementLink.create({
                        data: {
                            jiraTicketId: createdTicket.id,
                            requirementId: matchingRequirement.id,
                        },
                    });
                }
            }
        }
    });

    return {
        ...schemaStatus,
        hydrated: true,
    };
}

export async function syncCanonicalPrdState(params: {
    prdDocumentId: string;
    prdContent: PrdContent;
    prdVersion: number;
    sourceArtifactId?: string | null;
    changeSummary?: string | null;
}) {
    await assertCanonicalSchemaReady();
    await ensureCanonicalPrdState(params.prdDocumentId);

    const normalizedRequirements = normalizePrdRequirements(params.prdContent);

    return prisma.$transaction(async (tx) => {
        const existingRequirements = await tx.prdRequirement.findMany({
            where: { prdDocumentId: params.prdDocumentId },
            include: {
                versions: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
            },
        });

        const matcher = buildRequirementMatcher(existingRequirements);
        const consumedIds = new Set<string>();
        const changedRequirementIds: string[] = [];

        for (const requirement of normalizedRequirements) {
            const matchedRequirement = matcher(requirement, consumedIds);

            if (!matchedRequirement) {
                const createdRequirement = await tx.prdRequirement.create({
                    data: {
                        prdDocumentId: params.prdDocumentId,
                        stableKey: buildStableKey(requirement),
                        category: requirement.category,
                        displayId: requirement.displayId,
                        title: requirement.title,
                        description: requirement.description,
                        priority: requirement.priority,
                        status: 'active',
                    },
                });

                const createdVersion = await createRequirementVersion(tx, createdRequirement.id, params.prdVersion, requirement);

                await createRequirementChange(tx, {
                    prdDocumentId: params.prdDocumentId,
                    requirementId: createdRequirement.id,
                    prdVersion: params.prdVersion,
                    changeType: 'ADD',
                    summary: buildChangeSummary('ADD', requirement.title),
                    newVersionId: createdVersion.id,
                });

                changedRequirementIds.push(createdRequirement.id);
                continue;
            }

            consumedIds.add(matchedRequirement.id);

            const latestVersion = matchedRequirement.versions[0];
            const previousSnapshot = {
                category: matchedRequirement.category as 'functional' | 'non_functional',
                displayId: matchedRequirement.displayId,
                title: matchedRequirement.title,
                description: matchedRequirement.description,
                priority: matchedRequirement.priority,
            };

            await tx.prdRequirement.update({
                where: { id: matchedRequirement.id },
                data: {
                    category: requirement.category,
                    displayId: requirement.displayId,
                    title: requirement.title,
                    description: requirement.description,
                    priority: requirement.priority,
                    status: 'active',
                },
            });

            if (matchedRequirement.status === 'removed' || valuesDiffer(previousSnapshot, requirement)) {
                const updatedVersion = await createRequirementVersion(tx, matchedRequirement.id, params.prdVersion, requirement);

                await createRequirementChange(tx, {
                    prdDocumentId: params.prdDocumentId,
                    requirementId: matchedRequirement.id,
                    prdVersion: params.prdVersion,
                    changeType: matchedRequirement.status === 'removed' ? 'ADD' : 'UPDATE',
                    summary: buildChangeSummary(
                        matchedRequirement.status === 'removed' ? 'ADD' : 'UPDATE',
                        requirement.title
                    ),
                    oldVersionId: latestVersion?.id || null,
                    newVersionId: updatedVersion.id,
                });

                changedRequirementIds.push(matchedRequirement.id);
            }
        }

        for (const requirement of existingRequirements) {
            if (consumedIds.has(requirement.id) || requirement.status === 'removed') {
                continue;
            }

            await tx.prdRequirement.update({
                where: { id: requirement.id },
                data: { status: 'removed' },
            });

            await createRequirementChange(tx, {
                prdDocumentId: params.prdDocumentId,
                requirementId: requirement.id,
                prdVersion: params.prdVersion,
                changeType: 'REMOVE',
                summary: buildChangeSummary('REMOVE', requirement.title),
                oldVersionId: requirement.versions[0]?.id || null,
            });

            changedRequirementIds.push(requirement.id);
        }

        const artifactVersion = await tx.artifactVersion.create({
            data: {
                prdDocumentId: params.prdDocumentId,
                type: 'prd_content',
                prdVersion: params.prdVersion,
                status: 'current',
                sourceArtifactId: params.sourceArtifactId || null,
                payloadJson: toJsonValue({
                    prdContent: params.prdContent,
                    changedRequirementIds,
                    changeSummary: params.changeSummary || null,
                }),
            },
        });

        return {
            changedRequirementIds,
            artifactVersionIds: [artifactVersion.id],
        };
    });
}

export async function getChangedRequirementIds(prdDocumentId: string, prdVersion: number) {
    await assertCanonicalSchemaReady();

    const changes = await prisma.requirementChange.findMany({
        where: {
            prdDocumentId,
            prdVersion,
        },
        select: {
            requirementId: true,
        },
    });

    return Array.from(new Set(changes.map((change) => change.requirementId)));
}

export async function getProjectTimeline(projectId: string): Promise<TimelineEntry[]> {
    await assertCanonicalSchemaReady();

    const prdDocuments = await prisma.prdDocument.findMany({
        where: { projectId },
        select: { id: true },
    });

    const prdDocumentIds = prdDocuments.map((document) => document.id);

    const [requirementChanges, artifactVersions, updateLogs, auditEvents] = await Promise.all([
        prisma.requirementChange.findMany({
            where: { prdDocumentId: { in: prdDocumentIds } },
            include: {
                requirement: true,
            },
            orderBy: { createdAt: 'desc' },
        }),
        prisma.artifactVersion.findMany({
            where: { prdDocumentId: { in: prdDocumentIds } },
            orderBy: { createdAt: 'desc' },
        }),
        prisma.prdUpdateLog.findMany({
            where: { prdDocumentId: { in: prdDocumentIds } },
            orderBy: { createdAt: 'desc' },
        }),
        prisma.auditEvent.findMany({
            where: {
                OR: [
                    { entityId: { in: prdDocumentIds } },
                    { entityId: projectId },
                ],
            },
            orderBy: { createdAt: 'desc' },
        }),
    ]);

    const entries: TimelineEntry[] = [];

    for (const change of requirementChanges) {
        entries.push({
            id: `requirement-change-${change.id}`,
            type: 'requirement_change',
            title: `${change.changeType} requirement`,
            description: change.summary,
            timestamp: change.createdAt.toISOString(),
            metadata: {
                requirementId: change.requirementId,
                requirementTitle: change.requirement.title,
                prdVersion: change.prdVersion,
            },
        });
    }

    for (const artifact of artifactVersions) {
        entries.push({
            id: `artifact-version-${artifact.id}`,
            type: 'artifact_version',
            title: `${artifact.type} artifact`,
            description: `Artifact version recorded with status ${artifact.status}.`,
            timestamp: artifact.createdAt.toISOString(),
            metadata: {
                artifactVersionId: artifact.id,
                prdVersion: artifact.prdVersion,
                status: artifact.status,
                type: artifact.type,
            },
        });
    }

    for (const log of updateLogs) {
        entries.push({
            id: `prd-update-${log.id}`,
            type: 'prd_update',
            title: 'PRD updated',
            description: log.changesSummary || 'PRD content updated.',
            timestamp: log.createdAt.toISOString(),
        });
    }

    for (const event of auditEvents) {
        entries.push({
            id: `audit-${event.id}`,
            type: 'audit_event',
            title: event.action.replace(/_/g, ' '),
            description: `Audit event: ${event.action}`,
            timestamp: event.createdAt.toISOString(),
            metadata: (event.metadata as Record<string, unknown> | null) || undefined,
        });
    }

    return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
