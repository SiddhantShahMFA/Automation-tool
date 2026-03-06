import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getModelClient } from '@/lib/ai/client';
import {
    SYSTEM_PROMPT_GENERATE_PRD,
    buildGeneratePrdUserPrompt,
} from '@/lib/ai/prompts';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: sessionId } = await params;

        // Get session with questions and project
        const session = await prisma.generationSession.findUnique({
            where: { id: sessionId },
            include: {
                clarificationQuestions: { orderBy: { orderNum: 'asc' } },
                project: true,
            },
        });

        if (!session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        // Ensure required questions are answered
        const unanswered = session.clarificationQuestions.filter(
            (q) => q.required && (!q.answer || q.answer.trim().length === 0)
        );
        if (unanswered.length > 0) {
            return NextResponse.json(
                {
                    error: 'Required clarification questions are not yet answered',
                    unansweredQuestions: unanswered.map((q) => q.id),
                },
                { status: 400 }
            );
        }

        // Update session status
        await prisma.generationSession.update({
            where: { id: sessionId },
            data: { status: 'generating' },
        });

        // Get workspace settings for company name
        const settings = await prisma.workspaceSettings.findUnique({
            where: { id: 'default' },
        });

        // Build prompt & generate
        const questionsAndAnswers = session.clarificationQuestions
            .filter((q) => q.answer)
            .map((q) => ({
                question: q.question,
                answer: q.answer!,
            }));

        const { client, model } = await getModelClient();

        const completion = await client.chat.completions.create({
            model,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT_GENERATE_PRD },
                {
                    role: 'user',
                    content: buildGeneratePrdUserPrompt(
                        session.rawInput,
                        questionsAndAnswers,
                        settings?.companyName || undefined
                    ),
                },
            ],
            temperature: 0.5,
            max_tokens: 8000,
        });

        const content = completion.choices[0]?.message?.content || '{}';
        // Strip markdown code fences if present
        const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
        const prdContent = JSON.parse(cleaned);

        // Store artifact
        const artifact = await prisma.generatedArtifact.create({
            data: {
                sessionId,
                type: 'prd_draft',
                contentJson: prdContent,
            },
        });

        // Update PRD document with draft content
        const prdDoc = await prisma.prdDocument.findFirst({
            where: { projectId: session.projectId },
            orderBy: { createdAt: 'desc' },
        });

        if (prdDoc) {
            await prisma.prdDocument.update({
                where: { id: prdDoc.id },
                data: {
                    contentJson: prdContent,
                    title: prdContent.title || prdDoc.title,
                    status: 'draft',
                },
            });
        }

        // Update session and project
        await prisma.generationSession.update({
            where: { id: sessionId },
            data: { status: 'completed' },
        });

        await prisma.project.update({
            where: { id: session.projectId },
            data: { name: prdContent.title || session.project.name },
        });

        return NextResponse.json({
            success: true,
            artifactId: artifact.id,
            prdContent,
            prdDocumentId: prdDoc?.id,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('Generate PRD error:', err);

        // Try to reset session status on error
        try {
            const { id: sessionId } = await params;
            await prisma.generationSession.update({
                where: { id: sessionId },
                data: { status: 'failed' },
            });
        } catch {
            // ignore
        }

        return NextResponse.json({ error: message }, { status: 500 });
    }
}
