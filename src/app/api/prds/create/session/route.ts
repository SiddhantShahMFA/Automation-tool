import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getModelClient } from '@/lib/ai/client';
import {
    SYSTEM_PROMPT_CLARIFICATION,
    buildClarificationUserPrompt,
} from '@/lib/ai/prompts';

export async function POST(request: NextRequest) {
    try {
        const { title, rawInput } = await request.json();

        if (!rawInput || typeof rawInput !== 'string' || rawInput.trim().length < 10) {
            return NextResponse.json(
                { error: 'Please provide at least 10 characters of input material' },
                { status: 400 }
            );
        }

        // Create project and session
        const project = await prisma.project.create({
            data: {
                name: title || 'Untitled PRD',
            },
        });

        const prdDocument = await prisma.prdDocument.create({
            data: {
                projectId: project.id,
                title: title || 'Untitled PRD',
                status: 'draft',
                sourceSummary: rawInput.slice(0, 500),
            },
        });

        const session = await prisma.generationSession.create({
            data: {
                projectId: project.id,
                type: 'create',
                status: 'clarifying',
                rawInput,
            },
        });

        // Generate clarification questions using AI
        let questions: Array<{ question: string; required: boolean }> = [];

        try {
            const { client, model } = await getModelClient();
            const completion = await client.chat.completions.create({
                model,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT_CLARIFICATION },
                    { role: 'user', content: buildClarificationUserPrompt(rawInput) },
                ],
                temperature: 0.7,
                max_tokens: 2000,
            });

            const content = completion.choices[0]?.message?.content || '[]';
            // Strip markdown code fences if present
            const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
            questions = JSON.parse(cleaned);
        } catch (aiErr) {
            console.error('AI clarification error:', aiErr);
            // Fallback questions
            questions = [
                { question: 'Who are the primary target users for this product/feature?', required: true },
                { question: 'What are the key success metrics or KPIs?', required: true },
                { question: 'Are there any technical constraints or dependencies to consider?', required: true },
                { question: 'What is the expected timeline or priority level?', required: false },
                { question: 'Are there any existing solutions that this replaces or integrates with?', required: false },
            ];
        }

        // Store questions
        const storedQuestions = await Promise.all(
            questions.map((q, idx) =>
                prisma.clarificationQuestion.create({
                    data: {
                        sessionId: session.id,
                        question: q.question,
                        orderNum: idx + 1,
                        required: q.required ?? true,
                    },
                })
            )
        );

        return NextResponse.json({
            projectId: project.id,
            prdDocumentId: prdDocument.id,
            sessionId: session.id,
            questions: storedQuestions.map((q) => ({
                id: q.id,
                question: q.question,
                required: q.required,
                orderNum: q.orderNum,
            })),
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('Create session error:', err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
