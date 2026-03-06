import { NextRequest, NextResponse } from 'next/server';
import { verifyNotionToken } from '@/lib/notion/client';

export async function POST(request: NextRequest) {
    try {
        const { token } = await request.json();

        if (!token || typeof token !== 'string') {
            return NextResponse.json(
                { valid: false, databases: [], error: 'Token is required' },
                { status: 400 }
            );
        }

        const result = await verifyNotionToken(token);

        return NextResponse.json(result, {
            status: result.valid ? 200 : 400,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json(
            { valid: false, databases: [], error: message },
            { status: 500 }
        );
    }
}
