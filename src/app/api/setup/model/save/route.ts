import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { encrypt, maskSecret } from '@/lib/encryption';

export async function POST(request: NextRequest) {
    try {
        const { baseUrl, apiKey, model, headersJson } = await request.json();

        if (!baseUrl || !apiKey || !model) {
            return NextResponse.json(
                { error: 'baseUrl, apiKey, and model are required' },
                { status: 400 }
            );
        }

        const config = { baseUrl, apiKey, model, headersJson };
        const encryptedConfig = encrypt(JSON.stringify(config));
        const masked = maskSecret(apiKey);

        await prisma.integrationCredential.upsert({
            where: { type: 'model' },
            create: {
                type: 'model',
                encryptedConfig,
                maskedDisplay: masked,
            },
            update: {
                encryptedConfig,
                maskedDisplay: masked,
                isValid: true,
            },
        });

        return NextResponse.json({
            success: true,
            maskedApiKey: masked,
            model,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
