import { NextRequest, NextResponse } from 'next/server';
import { verifyModelConfig } from '@/lib/ai/client';

export async function POST(request: NextRequest) {
    try {
        const { baseUrl, apiKey, model, headersJson } = await request.json();

        if (!baseUrl || !apiKey || !model) {
            return NextResponse.json(
                { valid: false, error: 'baseUrl, apiKey, and model are required' },
                { status: 400 }
            );
        }

        const result = await verifyModelConfig({
            baseUrl,
            apiKey,
            model,
            headersJson,
        });

        return NextResponse.json(result, {
            status: result.valid ? 200 : 400,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json(
            { valid: false, error: message },
            { status: 500 }
        );
    }
}
