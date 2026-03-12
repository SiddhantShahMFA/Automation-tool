import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import { getModelClient } from '@/lib/ai/client';
import {
    CANONICAL_SCHEMA_REQUIRED_MESSAGE,
    createArtifactVersion,
    ensureCanonicalPrdState,
    getCanonicalSchemaStatus,
} from '@/lib/prd/canonical';
import { SYSTEM_PROMPT_GENERATE_PLAN, buildGeneratePlanUserPrompt } from '@/lib/ai/prompts';

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

        const canonicalSchema = await getCanonicalSchemaStatus();
        if (canonicalSchema.ready) {
            await ensureCanonicalPrdState(prdDocumentId);
        }

        const { client, model } = await getModelClient();

        const prdContentText = JSON.stringify(prdDoc.contentJson, null, 2);

        const completion = await client.chat.completions.create({
            model,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT_GENERATE_PLAN },
                {
                    role: 'user',
                    content: buildGeneratePlanUserPrompt(prdContentText),
                },
            ],
            temperature: 0.5,
            max_tokens: 4000,
        });

        const output = completion.choices[0]?.message?.content || '# PLAN';
        // Cleanup any markdown fences if it was wrapped globally, though standard markdown is expected
        const planMarkdown = output.replace(/^```markdown\n?|\n?```$/g, '').trim();

        // Save generated artifact
        const existingArtifact = await prisma.generatedArtifact.findFirst({
            where: { prdDocumentId, type: 'plan_md' },
        });

        let savedArtifactId: string;
        if (existingArtifact) {
            await prisma.generatedArtifact.update({
                where: { id: existingArtifact.id },
                data: { contentJson: { plan: planMarkdown } as Prisma.InputJsonValue },
            });
            savedArtifactId = existingArtifact.id;
        } else {
            const createdArtifact = await prisma.generatedArtifact.create({
                data: {
                    prdDocumentId,
                    type: 'plan_md',
                    contentJson: { plan: planMarkdown } as Prisma.InputJsonValue,
                },
            });
            savedArtifactId = createdArtifact.id;
        }

        let artifactVersionId: string | null = null;
        if (canonicalSchema.ready) {
            const artifactVersion = await createArtifactVersion({
                prdDocumentId,
                type: 'plan_md',
                prdVersion: prdDoc.version,
                status: 'draft',
                sourceArtifactId: savedArtifactId,
                payloadJson: { plan: planMarkdown },
            });
            artifactVersionId = artifactVersion.id;

            await prisma.auditEvent.create({
                data: {
                    action: 'plan_generated',
                    entityType: 'prd_document',
                    entityId: prdDocumentId,
                    metadata: {
                        artifactVersionId: artifactVersion.id,
                        prdVersion: prdDoc.version,
                    },
                },
            });
        }

        return NextResponse.json({
            success: true,
            plan: planMarkdown,
            artifactVersionId,
            canonicalSchemaReady: canonicalSchema.ready,
            warning: canonicalSchema.ready ? null : CANONICAL_SCHEMA_REQUIRED_MESSAGE,
            missingTables: canonicalSchema.ready ? [] : canonicalSchema.missingTables,
        });
    } catch (err: unknown) {
        return NextResponse.json(
            { success: false, error: err instanceof Error ? err.message : 'Unknown error generating PLAN.md' },
            { status: 500 }
        );
    }
}
