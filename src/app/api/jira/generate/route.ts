import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getModelClient } from '@/lib/ai/client';
import { SYSTEM_PROMPT_GENERATE_JIRA, buildGenerateJiraUserPrompt } from '@/lib/ai/prompts';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { prdDocumentId } = body;

        if (!prdDocumentId) {
            return NextResponse.json({ success: false, error: 'PRD Document ID is required' }, { status: 400 });
        }

        const prdDoc = await prisma.prdDocument.findUnique({
            where: { id: prdDocumentId },
        });

        if (!prdDoc || !prdDoc.contentJson) {
            return NextResponse.json({ success: false, error: 'PRD document or content not found' }, { status: 400 });
        }

        // Get existing tickets if they exist
        const existingJiraArtifact = await prisma.generatedArtifact.findFirst({
            where: {
                prdDocumentId,
                type: 'jira_tickets',
            },
            orderBy: { createdAt: 'desc' },
        });

        let existingTicketsStr = '';
        if (existingJiraArtifact) {
            const content = existingJiraArtifact.contentJson as Record<string, unknown>;
            if (content.tickets && Array.isArray(content.tickets)) {
                existingTicketsStr = JSON.stringify(content.tickets);
            } else if (Array.isArray(content)) {
                existingTicketsStr = JSON.stringify(content);
            }
        }

        const { client, model } = await getModelClient();

        const prdContentText = JSON.stringify(prdDoc.contentJson, null, 2);

        console.log(`Generating Jira tickets for PRD ${prdDocumentId}`);
        const userPrompt = buildGenerateJiraUserPrompt(
            prdContentText,
            existingTicketsStr
        );

        const completion = await client.chat.completions.create({
            model,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT_GENERATE_JIRA },
                {
                    role: 'user',
                    content: buildGenerateJiraUserPrompt(prdContentText),
                },
            ],
            temperature: 0.5,
            max_tokens: 4000,
        });

        const output = completion.choices[0]?.message?.content || '[]';
        // Strip markdown
        const cleaned = output.replace(/```json\n?|\n?```/g, '').trim();
        const tickets = JSON.parse(cleaned);

        // Save generated artifact
        // Check if there is already an artifact for this PRD to avoid duplicates, but we could just add a new one or upsert.
        // Let's see if one exists
        const existingArtifact = await prisma.generatedArtifact.findFirst({
            where: { prdDocumentId, type: 'jira_tickets' },
        });

        if (existingArtifact) {
            await prisma.generatedArtifact.update({
                where: { id: existingArtifact.id },
                data: { contentJson: { tickets } },
            });
        } else {
            await prisma.generatedArtifact.create({
                data: {
                    prdDocumentId,
                    type: 'jira_tickets',
                    contentJson: { tickets },
                },
            });
        }

        return NextResponse.json({ success: true, tickets });
    } catch (err: unknown) {
        return NextResponse.json(
            { success: false, error: err instanceof Error ? err.message : 'Unknown error generating Jira tickets' },
            { status: 500 }
        );
    }
}
