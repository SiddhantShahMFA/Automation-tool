import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { jiraProjectKey } = body;

        if (!jiraProjectKey) {
            return NextResponse.json({ success: false, error: 'Jira project key is required' }, { status: 400 });
        }

        const project = await prisma.project.update({
            where: { id },
            data: { jiraProjectKey },
        });

        return NextResponse.json({ success: true, project });
    } catch (err: unknown) {
        return NextResponse.json(
            { success: false, error: err instanceof Error ? err.message : 'Unknown error updating project' },
            { status: 500 }
        );
    }
}
