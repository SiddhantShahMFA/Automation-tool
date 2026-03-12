import { randomUUID } from 'crypto';

import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import { getModelClient } from '@/lib/ai/client';
import {
    SYSTEM_PROMPT_GENERATE_JIRA_DELTA,
    buildGenerateJiraDeltaUserPrompt,
} from '@/lib/ai/prompts';
import { getJiraConfig, JiraDraftTicket, syncJiraTickets } from '@/lib/jira/client';
import { assertCanonicalSchemaReady, createArtifactVersion, ensureCanonicalPrdState, getChangedRequirementIds } from '@/lib/prd/canonical';
import type { PrdContent } from '@/lib/prd/types';

interface JiraDeltaAction extends JiraDraftTicket {
    id: string;
    projectKey: string | null;
    requirementIds: string[];
}

function coerceAction(value: string | undefined): 'CREATE' | 'UPDATE' | 'KEEP' | 'CLOSE' {
    if (value === 'UPDATE' || value === 'KEEP' || value === 'CLOSE') {
        return value;
    }
    return 'CREATE';
}

function buildFallbackActions(params: {
    prdDocumentId: string;
    projectKey: string;
    prdTitle: string;
    changedRequirements: Array<{
        id: string;
        title: string;
        description: string;
        priority: string | null;
        status: string;
    }>;
    existingTickets: Array<{
        id: string;
        issueKey: string | null;
        type: string;
        summary: string;
        description: string;
        requirementLinks: Array<{ requirementId: string }>;
    }>;
}): JiraDeltaAction[] {
    const actions: JiraDeltaAction[] = [];
    const existingEpic = params.existingTickets.find((ticket) => ticket.type === 'Epic');

    if (!existingEpic) {
        actions.push({
            id: randomUUID(),
            action: 'CREATE',
            issueKey: undefined,
            projectKey: params.projectKey,
            type: 'Epic',
            summary: `${params.prdTitle} Delivery`,
            description: `Epic generated from PRD ${params.prdTitle}.`,
            requirementIds: [],
        });
    } else {
        actions.push({
            id: randomUUID(),
            action: 'KEEP',
            issueKey: existingEpic.issueKey || undefined,
            projectKey: params.projectKey,
            type: 'Epic',
            summary: existingEpic.summary,
            description: existingEpic.description,
            requirementIds: [],
        });
    }

    for (const requirement of params.changedRequirements) {
        const existingTicket = params.existingTickets.find((ticket) =>
            ticket.type === 'Story' &&
            ticket.requirementLinks.some((link) => link.requirementId === requirement.id)
        );

        if (requirement.status === 'removed') {
            if (existingTicket?.issueKey) {
                actions.push({
                    id: randomUUID(),
                    action: 'CLOSE',
                    issueKey: existingTicket.issueKey,
                    projectKey: params.projectKey,
                    type: 'Story',
                    summary: existingTicket.summary,
                    description: existingTicket.description,
                    requirementIds: [requirement.id],
                });
            }
            continue;
        }

        actions.push({
            id: randomUUID(),
            action: existingTicket?.issueKey ? 'UPDATE' : 'CREATE',
            issueKey: existingTicket?.issueKey || undefined,
            projectKey: params.projectKey,
            type: 'Story',
            summary: requirement.title,
            description: `${requirement.description}${requirement.priority ? `\n\nPriority: ${requirement.priority}` : ''}`,
            requirementIds: [requirement.id],
        });
    }

    return actions;
}

function normalizeDeltaActions(rawActions: unknown, projectKey: string): JiraDeltaAction[] {
    if (!Array.isArray(rawActions)) {
        return [];
    }

    return rawActions
        .filter((action): action is Record<string, unknown> => typeof action === 'object' && action !== null)
        .map((action) => ({
            id: typeof action.id === 'string' ? action.id : randomUUID(),
            action: coerceAction(typeof action.action === 'string' ? action.action : undefined),
            issueKey: typeof action.issueKey === 'string' ? action.issueKey : undefined,
            projectKey: typeof action.projectKey === 'string' ? action.projectKey : projectKey,
            type: action.type === 'Epic' ? 'Epic' : 'Story',
            summary: typeof action.summary === 'string' ? action.summary : 'Untitled Ticket',
            description: typeof action.description === 'string' ? action.description : '',
            requirementIds: Array.isArray(action.requirementIds)
                ? action.requirementIds.filter((id): id is string => typeof id === 'string')
                : [],
        }));
}

export async function generateJiraDelta(params: {
    prdDocumentId: string;
    targetProjectKey?: string | null;
}) {
    await assertCanonicalSchemaReady();
    await ensureCanonicalPrdState(params.prdDocumentId);

    const prdDocument = await prisma.prdDocument.findUnique({
        where: { id: params.prdDocumentId },
        include: {
            project: true,
            requirements: true,
            jiraTickets: {
                include: {
                    requirementLinks: true,
                },
            },
        },
    });

    if (!prdDocument || !prdDocument.contentJson) {
        throw new Error('PRD document or content not found');
    }

    const workspace = await prisma.workspaceSettings.findUnique({
        where: { id: 'default' },
    });

    const targetProjectKey = params.targetProjectKey || prdDocument.project.jiraProjectKey || workspace?.jiraProjectKey || null;
    if (!targetProjectKey) {
        throw new Error('Jira project space not configured.');
    }

    const changedRequirementIds = await getChangedRequirementIds(prdDocument.id, prdDocument.version);
    const changedRequirements = prdDocument.requirements.filter((requirement) => changedRequirementIds.includes(requirement.id));

    let actions: JiraDeltaAction[] = [];

    if (changedRequirements.length > 0) {
        try {
            const { client, model } = await getModelClient();
            const completion = await client.chat.completions.create({
                model,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT_GENERATE_JIRA_DELTA },
                    {
                        role: 'user',
                        content: buildGenerateJiraDeltaUserPrompt({
                            prdContentText: JSON.stringify(prdDocument.contentJson as unknown as PrdContent, null, 2),
                            changedRequirementsJson: JSON.stringify(changedRequirements, null, 2),
                            existingTicketsJson: JSON.stringify(prdDocument.jiraTickets, null, 2),
                            targetProjectKey,
                        }),
                    },
                ],
                temperature: 0.3,
                max_tokens: 4000,
            });

            const content = completion.choices[0]?.message?.content || '[]';
            const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
            actions = normalizeDeltaActions(JSON.parse(cleaned), targetProjectKey);
        } catch (error) {
            console.error('Jira delta AI generation failed, using fallback', error);
        }
    }

    if (actions.length === 0) {
        actions = buildFallbackActions({
            prdDocumentId: prdDocument.id,
            projectKey: targetProjectKey,
            prdTitle: prdDocument.title || prdDocument.project.name,
            changedRequirements: changedRequirements.map((requirement) => ({
                id: requirement.id,
                title: requirement.title,
                description: requirement.description,
                priority: requirement.priority,
                status: requirement.status,
            })),
            existingTickets: prdDocument.jiraTickets.map((ticket) => ({
                id: ticket.id,
                issueKey: ticket.issueKey,
                type: ticket.type,
                summary: ticket.summary,
                description: ticket.description,
                requirementLinks: ticket.requirementLinks.map((link) => ({ requirementId: link.requirementId })),
            })),
        });
    }

    const artifactVersion = await createArtifactVersion({
        prdDocumentId: prdDocument.id,
        type: 'jira_delta',
        prdVersion: prdDocument.version,
        status: 'draft',
        payloadJson: {
            targetProjectKey,
            changedRequirementIds,
            actions,
        },
    });

    const existingArtifact = await prisma.generatedArtifact.findFirst({
        where: { prdDocumentId: prdDocument.id, type: 'jira_tickets' },
    });

    if (existingArtifact) {
        await prisma.generatedArtifact.update({
            where: { id: existingArtifact.id },
            data: {
                contentJson: {
                    tickets: actions,
                    artifactVersionId: artifactVersion.id,
                    targetProjectKey,
                    changedRequirementIds,
                } as unknown as Prisma.InputJsonValue,
            },
        });
    } else {
        await prisma.generatedArtifact.create({
            data: {
                prdDocumentId: prdDocument.id,
                type: 'jira_tickets',
                contentJson: {
                    tickets: actions,
                    artifactVersionId: artifactVersion.id,
                    targetProjectKey,
                    changedRequirementIds,
                } as unknown as Prisma.InputJsonValue,
            },
        });
    }

    await prisma.auditEvent.create({
        data: {
            action: 'jira_delta_generated',
            entityType: 'prd_document',
            entityId: prdDocument.id,
            metadata: {
                artifactVersionId: artifactVersion.id,
                targetProjectKey,
                changedRequirementIds,
            },
        },
    });

    return {
        artifactVersionId: artifactVersion.id,
        targetProjectKey,
        changedRequirementIds,
        actions,
    };
}

export async function publishJiraDelta(params: {
    prdDocumentId: string;
    targetProjectKey?: string | null;
    artifactVersionId?: string | null;
    approvedActionIds?: string[];
}) {
    await assertCanonicalSchemaReady();
    await ensureCanonicalPrdState(params.prdDocumentId);

    const prdDocument = await prisma.prdDocument.findUnique({
        where: { id: params.prdDocumentId },
    });

    if (!prdDocument) {
        throw new Error('PRD not found');
    }

    const artifactVersion = params.artifactVersionId
        ? await prisma.artifactVersion.findUnique({ where: { id: params.artifactVersionId } })
        : await prisma.artifactVersion.findFirst({
            where: {
                prdDocumentId: params.prdDocumentId,
                type: 'jira_delta',
            },
            orderBy: { createdAt: 'desc' },
        });

    if (!artifactVersion) {
        throw new Error('Jira delta artifact not found');
    }

    const payload = artifactVersion.payloadJson as {
        actions?: JiraDeltaAction[];
        targetProjectKey?: string;
    };

    const allActions = Array.isArray(payload.actions) ? payload.actions : [];
    const approvedActionIds = params.approvedActionIds?.length
        ? new Set(params.approvedActionIds)
        : new Set(allActions.map((action) => action.id));
    const approvedActions = allActions.filter((action) => approvedActionIds.has(action.id));

    const targetProjectKey = params.targetProjectKey || payload.targetProjectKey || null;
    if (!targetProjectKey) {
        throw new Error('Jira project space not configured.');
    }

    const config = await getJiraConfig();
    const actionableTickets = approvedActions.filter((action) => action.action !== 'CLOSE');
    const syncedTickets = actionableTickets.length > 0
        ? await syncJiraTickets(config, targetProjectKey, actionableTickets)
        : [];

    const publishedUrls = syncedTickets
        .filter((ticket) => !!ticket.issueKey)
        .map((ticket) => `https://${config.domain}/browse/${ticket.issueKey}`);

    await prisma.$transaction(async (tx) => {
        for (const action of approvedActions) {
            if (action.action === 'CLOSE') {
                const existingTicket = action.issueKey
                    ? await tx.jiraTicket.findFirst({
                        where: {
                            prdDocumentId: params.prdDocumentId,
                            issueKey: action.issueKey,
                        },
                    })
                    : null;

                if (existingTicket) {
                    await tx.jiraTicket.update({
                        where: { id: existingTicket.id },
                        data: {
                            status: 'close_recommended',
                            lastAction: 'CLOSE',
                            summary: action.summary,
                            description: action.description,
                            projectKey: targetProjectKey,
                        },
                    });
                }
                continue;
            }

            const synced = syncedTickets.find((ticket) => ticket.summary === action.summary && ticket.type === action.type)
                || syncedTickets.find((ticket) => ticket.issueKey && ticket.issueKey === action.issueKey);

            const issueKey = synced?.issueKey || action.issueKey || null;
            let canonicalTicket = issueKey
                ? await tx.jiraTicket.findFirst({
                    where: {
                        prdDocumentId: params.prdDocumentId,
                        issueKey,
                    },
                })
                : null;

            if (!canonicalTicket) {
                canonicalTicket = await tx.jiraTicket.create({
                    data: {
                        prdDocumentId: params.prdDocumentId,
                        projectKey: targetProjectKey,
                        issueKey,
                        type: action.type,
                        summary: action.summary,
                        description: action.description,
                        status: issueKey ? 'published' : 'draft',
                        lastAction: action.action || 'CREATE',
                    },
                });
            } else {
                canonicalTicket = await tx.jiraTicket.update({
                    where: { id: canonicalTicket.id },
                    data: {
                        projectKey: targetProjectKey,
                        issueKey,
                        type: action.type,
                        summary: action.summary,
                        description: action.description,
                        status: issueKey ? 'published' : 'draft',
                        lastAction: action.action || 'CREATE',
                    },
                });
            }

            await tx.jiraTicketRequirementLink.deleteMany({
                where: { jiraTicketId: canonicalTicket.id },
            });

            for (const requirementId of action.requirementIds || []) {
                await tx.jiraTicketRequirementLink.create({
                    data: {
                        jiraTicketId: canonicalTicket.id,
                        requirementId,
                    },
                });
            }
        }

        await tx.artifactVersion.create({
            data: {
                prdDocumentId: params.prdDocumentId,
                type: 'jira_publish',
                prdVersion: prdDocument.version,
                status: 'published',
                payloadJson: {
                    artifactVersionId: artifactVersion.id,
                    targetProjectKey,
                    approvedActionIds: Array.from(approvedActionIds),
                    actions: approvedActions,
                    publishedUrls,
                } as unknown as Prisma.InputJsonValue,
            },
        });
    });

    const existingArtifact = await prisma.generatedArtifact.findFirst({
        where: { prdDocumentId: params.prdDocumentId, type: 'jira_tickets' },
    });

    if (existingArtifact) {
        await prisma.generatedArtifact.update({
            where: { id: existingArtifact.id },
            data: {
                contentJson: {
                    tickets: approvedActions,
                    publishedUrls,
                    artifactVersionId: artifactVersion.id,
                    targetProjectKey,
                } as unknown as Prisma.InputJsonValue,
            },
        });
    }

    await prisma.auditEvent.create({
        data: {
            action: 'jira_delta_published',
            entityType: 'prd_document',
            entityId: params.prdDocumentId,
            metadata: {
                artifactVersionId: artifactVersion.id,
                targetProjectKey,
                approvedActionIds: Array.from(approvedActionIds),
            },
        },
    });

    return {
        artifactVersionId: artifactVersion.id,
        urls: publishedUrls,
        actions: approvedActions,
    };
}
