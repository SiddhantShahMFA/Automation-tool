import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: sessionId } = await params;
        const { answers } = await request.json();

        if (!answers || !Array.isArray(answers)) {
            return NextResponse.json(
                { error: 'answers must be an array of { questionId, text }' },
                { status: 400 }
            );
        }

        // Validate session exists
        const session = await prisma.generationSession.findUnique({
            where: { id: sessionId },
            include: { clarificationQuestions: true },
        });

        if (!session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        // Update each question with its answer
        for (const answer of answers) {
            if (answer.questionId && answer.text) {
                await prisma.clarificationQuestion.update({
                    where: { id: answer.questionId },
                    data: { answer: answer.text },
                });
            }
        }

        // Check if all required questions are answered
        const updatedQuestions = await prisma.clarificationQuestion.findMany({
            where: { sessionId },
            orderBy: { orderNum: 'asc' },
        });

        const allRequiredAnswered = updatedQuestions
            .filter((q) => q.required)
            .every((q) => q.answer && q.answer.trim().length > 0);

        return NextResponse.json({
            success: true,
            allRequiredAnswered,
            questions: updatedQuestions.map((q) => ({
                id: q.id,
                question: q.question,
                answer: q.answer,
                required: q.required,
                orderNum: q.orderNum,
            })),
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
