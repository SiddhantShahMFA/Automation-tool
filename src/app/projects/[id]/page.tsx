import { prisma } from '@/lib/db';
import {
    CANONICAL_SCHEMA_REQUIRED_MESSAGE,
    ensureCanonicalPrdState,
    getCanonicalSchemaStatus,
    getProjectTimeline,
} from '@/lib/prd/canonical';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

import JiraSection from '@/components/JiraSection';
import PlanSection from '@/components/PlanSection';
import TimelineSection from '@/components/TimelineSection';
import type { JiraDraftTicket } from '@/lib/jira/client';

interface PrdContent {
    title?: string;
    overview?: string;
    goals?: string[];
    targetUsers?: Array<{ persona: string; description: string }>;
    scope?: { inScope?: string[]; outOfScope?: string[] };
    functionalRequirements?: Array<{ id: string; title: string; description: string; priority: string }>;
    nonFunctionalRequirements?: Array<{ id: string; title: string; description: string }>;
    openQuestions?: string[];
    assumptions?: string[];
}

export default async function ProjectDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const project = await prisma.project.findUnique({
        where: { id },
        include: {
            prdDocuments: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                include: { generatedArtifacts: true },
            },
            generationSessions: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                include: {
                    clarificationQuestions: { orderBy: { orderNum: 'asc' } },
                },
            },
        },
    });

    if (!project) {
        notFound();
    }

    const projectJiraKey = project.jiraProjectKey || null;

    const latestPrd = project.prdDocuments[0];
    const prdContent = latestPrd?.contentJson as PrdContent | null;
    const canonicalSchema = await getCanonicalSchemaStatus();
    const canonicalSchemaReady = canonicalSchema.ready;

    if (latestPrd && canonicalSchemaReady) {
        await ensureCanonicalPrdState(latestPrd.id);
    }

    const statusLabel = latestPrd?.status || 'new';
    const statusBadge =
        statusLabel === 'published' ? 'badge-success' : statusLabel === 'draft' ? 'badge-warning' : 'badge-default';

    // Get Jira state
    const workspace = await prisma.workspaceSettings.findUnique({ where: { id: 'default' } });
    const jiraConfigured = !!workspace?.jiraProjectKey;
    const jiraArtifact = latestPrd?.generatedArtifacts.find((a) => a.type === 'jira_tickets');
    let existingJiraTickets: JiraDraftTicket[] | null = null;
    let publishedJiraUrls: string[] | null = null;
    let jiraArtifactVersionId: string | null = null;

    if (jiraArtifact) {
        const content = jiraArtifact.contentJson as Record<string, unknown>;
        const ticketPayload = Array.isArray(content.tickets)
            ? content.tickets as JiraDraftTicket[]
            : Array.isArray(content)
                ? content as unknown as JiraDraftTicket[]
                : null;
        if (content.publishedUrls) {
            existingJiraTickets = ticketPayload;
            publishedJiraUrls = content.publishedUrls as string[];
        } else {
            existingJiraTickets = ticketPayload;
        }
        jiraArtifactVersionId = typeof content.artifactVersionId === 'string' ? content.artifactVersionId : null;
    }

    const defaultJiraProjectKey = workspace?.jiraProjectKey || null;

    // Get Plan state
    const planArtifact = latestPrd?.generatedArtifacts.find((a) => a.type === 'plan_md');
    let existingPlan = null;
    if (planArtifact) {
        const content = planArtifact.contentJson as Record<string, unknown>;
        existingPlan = content.plan as string || null;
    }

    const timeline = canonicalSchemaReady ? await getProjectTimeline(project.id) : [];

    return (
        <div className="page-container">
            <div className="page-header">
                <div className="flex items-center gap-md" style={{ marginBottom: 'var(--sp-sm)' }}>
                    <Link href="/projects" className="btn btn-ghost btn-sm">
                        ← Projects
                    </Link>
                </div>
                <div className="page-header-actions">
                    <div>
                        <h1>{project.name}</h1>
                        <div className="flex items-center gap-md mt-md">
                            <span className={`badge ${statusBadge}`}>{statusLabel}</span>
                            {latestPrd && <span className="text-secondary text-sm">v{latestPrd.version}</span>}
                            <span className="text-secondary text-sm">
                                Updated{' '}
                                {new Date(project.updatedAt).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </span>
                        </div>
                    </div>
                    <div className="flex gap-md">
                        {latestPrd?.notionPageUrl && (
                            <a
                                href={latestPrd.notionPageUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-secondary"
                            >
                                📄 Open in Notion
                            </a>
                        )}
                    </div>
                </div>
            </div>

            {!canonicalSchemaReady && (
                <div className="alert alert-warning mb-md">
                    {CANONICAL_SCHEMA_REQUIRED_MESSAGE} Missing tables: {canonicalSchema.missingTables.join(', ')}.
                </div>
            )}

            {/* PRD Content */}
            {prdContent ? (
                <div className="card">
                    {prdContent.overview && (
                        <div className="prd-section">
                            <h2>Overview</h2>
                            <p>{prdContent.overview}</p>
                        </div>
                    )}

                    {prdContent.goals && prdContent.goals.length > 0 && (
                        <div className="prd-section">
                            <h2>Goals</h2>
                            <ul>
                                {prdContent.goals.map((g, i) => (
                                    <li key={i}>{g}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {prdContent.targetUsers && prdContent.targetUsers.length > 0 && (
                        <div className="prd-section">
                            <h2>Target Users</h2>
                            {prdContent.targetUsers.map((u, i) => (
                                <div key={i} style={{ marginBottom: 'var(--sp-md)' }}>
                                    <h3>{u.persona}</h3>
                                    <p>{u.description}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {prdContent.scope && (
                        <div className="prd-section">
                            <h2>Scope</h2>
                            {prdContent.scope.inScope && (
                                <>
                                    <h3>In Scope</h3>
                                    <ul>
                                        {prdContent.scope.inScope.map((s, i) => (
                                            <li key={i}>{s}</li>
                                        ))}
                                    </ul>
                                </>
                            )}
                            {prdContent.scope.outOfScope && (
                                <>
                                    <h3 style={{ marginTop: 'var(--sp-md)' }}>Out of Scope</h3>
                                    <ul>
                                        {prdContent.scope.outOfScope.map((s, i) => (
                                            <li key={i}>{s}</li>
                                        ))}
                                    </ul>
                                </>
                            )}
                        </div>
                    )}

                    {prdContent.functionalRequirements && prdContent.functionalRequirements.length > 0 && (
                        <div className="prd-section">
                            <h2>Functional Requirements</h2>
                            {prdContent.functionalRequirements.map((r) => (
                                <div key={r.id} style={{ marginBottom: 'var(--sp-md)' }}>
                                    <h3>
                                        {r.id}: {r.title}{' '}
                                        <span className="badge badge-accent">{r.priority}</span>
                                    </h3>
                                    <p>{r.description}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {prdContent.nonFunctionalRequirements && prdContent.nonFunctionalRequirements.length > 0 && (
                        <div className="prd-section">
                            <h2>Non-Functional Requirements</h2>
                            {prdContent.nonFunctionalRequirements.map((r) => (
                                <div key={r.id} style={{ marginBottom: 'var(--sp-md)' }}>
                                    <h3>
                                        {r.id}: {r.title}
                                    </h3>
                                    <p>{r.description}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {prdContent.openQuestions && prdContent.openQuestions.length > 0 && (
                        <div className="prd-section">
                            <h2>Open Questions</h2>
                            <ul>
                                {prdContent.openQuestions.map((q, i) => (
                                    <li key={i}>{q}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {prdContent.assumptions && prdContent.assumptions.length > 0 && (
                        <div className="prd-section">
                            <h2>Assumptions</h2>
                            <ul>
                                {prdContent.assumptions.map((a, i) => (
                                    <li key={i}>{a}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            ) : (
                <div className="empty-state">
                    <div className="empty-state-icon">📝</div>
                    <h3>No PRD content yet</h3>
                    <p>This project&apos;s PRD hasn&apos;t been generated yet.</p>
                </div>
            )}

            {/* Plan Integration */}
            {latestPrd && (
                <PlanSection
                    prdDocumentId={latestPrd.id}
                    existingPlan={existingPlan}
                />
            )}

            {/* Jira Integration */}
            {latestPrd && jiraConfigured && canonicalSchemaReady && (
                <JiraSection
                    prdDocumentId={latestPrd.id}
                    projectId={project.id}
                    existingTickets={existingJiraTickets}
                    publishedUrls={publishedJiraUrls}
                    artifactVersionId={jiraArtifactVersionId}
                    defaultWorkspaceJiraProjectKey={defaultJiraProjectKey}
                    savedJiraProjectKey={projectJiraKey}
                />
            )}

            {canonicalSchemaReady && <TimelineSection entries={timeline} />}
        </div>
    );
}
