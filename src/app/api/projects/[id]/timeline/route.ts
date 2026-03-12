import { NextResponse } from 'next/server';

import {
    CANONICAL_SCHEMA_REQUIRED_MESSAGE,
    getCanonicalSchemaStatus,
    getProjectTimeline,
} from '@/lib/prd/canonical';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const schemaStatus = await getCanonicalSchemaStatus();
        if (!schemaStatus.ready) {
            return NextResponse.json(
                {
                    success: false,
                    error: CANONICAL_SCHEMA_REQUIRED_MESSAGE,
                    missingTables: schemaStatus.missingTables,
                },
                { status: 503 }
            );
        }
        const timeline = await getProjectTimeline(id);
        return NextResponse.json({ success: true, timeline });
    } catch (err: unknown) {
        return NextResponse.json(
            { success: false, error: err instanceof Error ? err.message : 'Unknown error loading timeline' },
            { status: 500 }
        );
    }
}
