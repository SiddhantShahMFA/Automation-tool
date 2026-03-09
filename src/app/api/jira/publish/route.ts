import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getJiraConfig, syncJiraTickets, JiraDraftTicket } from '@/lib/jira/client';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { prdDocumentId, targetProjectKey: requestedProjectKey } = body;

        if (!prdDocumentId) {
            return NextResponse.json({ success: false, error: 'PRD Document ID is required' }, { status: 400 });
        }

        // Get Jira ticket artifact
        const jiraArtifact = await prisma.generatedArtifact.findFirst({
            where: { prdDocumentId, type: 'jira_tickets' },
        });

        if (!jiraArtifact) {
            return NextResponse.json({ success: false, error: 'Jira tickets not generated yet' }, { status: 400 });
        }

        const content = jiraArtifact.contentJson as Record<string, unknown>;
        const tickets = (content.tickets || content) as JiraDraftTicket[]; // accommodate both structures

        if (!Array.isArray(tickets) || tickets.length === 0) {
            return NextResponse.json({ success: false, error: 'No tickets found in artifact' }, { status: 400 });
        }

        const config = await getJiraConfig();

        const prd = await prisma.prdDocument.findUnique({
            where: { id: prdDocumentId },
            include: { project: true }
        });

        if (!prd) {
            return NextResponse.json({ success: false, error: 'PRD not found' }, { status: 400 });
        }

        const workspace = await prisma.workspaceSettings.findUnique({
            where: { id: 'default' },
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const targetProjectKey = requestedProjectKey || (prd.project as any).jiraProjectKey || workspace?.jiraProjectKey;

        if (!targetProjectKey) {
            return NextResponse.json({ success: false, error: 'Jira project space not configured.' }, { status: 400 });
        }

        const createdIssueKeys = await syncJiraTickets(config, targetProjectKey, tickets);

        // Generate URLs
        const urls = createdIssueKeys.map((key) => `https://${config.domain}/browse/${key}`);

        // Update artifact to store published URLs
        await prisma.generatedArtifact.update({
            where: { id: jiraArtifact.id },
            data: {
                contentJson: {
                    tickets,
                    publishedUrls: urls,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any,
            },
        });

        return NextResponse.json({ success: true, urls });
    } catch (err: unknown) {
        return NextResponse.json(
            { success: false, error: err instanceof Error ? err.message : 'Unknown error publishing to Jira' },
            { status: 500 }
        );
    }
}
