import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { encrypt, maskSecret } from '@/lib/encryption';

export async function POST(request: NextRequest) {
    try {
        const { token, databaseId, databaseName } = await request.json();

        if (!token || !databaseId) {
            return NextResponse.json(
                { error: 'Token and databaseId are required' },
                { status: 400 }
            );
        }

        const encryptedConfig = encrypt(JSON.stringify({ token }));
        const masked = maskSecret(token);

        // Upsert the Notion credential
        await prisma.integrationCredential.upsert({
            where: { type: 'notion' },
            create: {
                type: 'notion',
                encryptedConfig,
                maskedDisplay: masked,
            },
            update: {
                encryptedConfig,
                maskedDisplay: masked,
                isValid: true,
            },
        });

        // Update workspace settings with database info
        await prisma.workspaceSettings.upsert({
            where: { id: 'default' },
            create: {
                notionDatabaseId: databaseId,
                notionDatabaseName: databaseName || 'PRD Database',
            },
            update: {
                notionDatabaseId: databaseId,
                notionDatabaseName: databaseName || 'PRD Database',
            },
        });

        return NextResponse.json({
            success: true,
            maskedToken: masked,
            databaseName: databaseName || 'PRD Database',
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
