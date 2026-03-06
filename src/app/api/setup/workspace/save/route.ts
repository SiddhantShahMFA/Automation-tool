import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const { companyName } = await request.json();

        await prisma.workspaceSettings.upsert({
            where: { id: 'default' },
            create: {
                companyName: companyName || null,
                setupCompleted: true,
            },
            update: {
                companyName: companyName || null,
                setupCompleted: true,
            },
        });

        // Create audit event
        await prisma.auditEvent.create({
            data: {
                action: 'setup_completed',
                metadata: { companyName },
            },
        });

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
