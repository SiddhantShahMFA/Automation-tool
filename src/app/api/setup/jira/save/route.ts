import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { verifyJiraCredentials } from '@/lib/jira/client';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { domain, email, apiToken, projectKey } = body;

        if (!domain || !email || !apiToken || !projectKey) {
            return NextResponse.json({ success: false, error: 'Missing Jira configuration' }, { status: 400 });
        }

        // Clean domain
        const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');

        // Verify one more time before saving just in case
        const verifyRes = await verifyJiraCredentials(cleanDomain, email, apiToken);
        if (!verifyRes.valid) {
            return NextResponse.json({ success: false, error: 'Invalid Jira credentials' }, { status: 400 });
        }

        const configJson = JSON.stringify({ domain: cleanDomain, email, apiToken });
        const masked = `${email.split('@')[0]}@****`;

        // UPSERT
        const existing = await prisma.integrationCredential.findUnique({
            where: { type: 'jira' },
        });

        if (existing) {
            await prisma.integrationCredential.update({
                where: { id: existing.id },
                data: {
                    encryptedConfig: encrypt(configJson),
                    maskedDisplay: masked,
                    isValid: true,
                },
            });
        } else {
            await prisma.integrationCredential.create({
                data: {
                    type: 'jira',
                    encryptedConfig: encrypt(configJson),
                    maskedDisplay: masked,
                    isValid: true,
                },
            });
        }

        // Update default workspace setting
        await prisma.workspaceSettings.update({
            where: { id: 'default' },
            data: { jiraProjectKey: projectKey },
        });

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        return NextResponse.json(
            { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
