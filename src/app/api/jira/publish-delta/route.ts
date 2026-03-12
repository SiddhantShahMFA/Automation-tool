import { NextRequest, NextResponse } from 'next/server';

import { publishJiraDelta } from '@/lib/jira/delta';
import { CANONICAL_SCHEMA_REQUIRED_MESSAGE, isCanonicalSchemaNotReadyError } from '@/lib/prd/canonical';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { prdDocumentId, targetProjectKey, artifactVersionId, approvedActionIds } = body;

        if (!prdDocumentId) {
            return NextResponse.json({ success: false, error: 'PRD Document ID is required' }, { status: 400 });
        }

        const result = await publishJiraDelta({
            prdDocumentId,
            targetProjectKey,
            artifactVersionId,
            approvedActionIds,
        });

        return NextResponse.json({ success: true, ...result });
    } catch (err: unknown) {
        if (isCanonicalSchemaNotReadyError(err)) {
            return NextResponse.json(
                { success: false, error: CANONICAL_SCHEMA_REQUIRED_MESSAGE, missingTables: err.missingTables },
                { status: 503 }
            );
        }
        return NextResponse.json(
            { success: false, error: err instanceof Error ? err.message : 'Unknown error publishing Jira delta' },
            { status: 500 }
        );
    }
}
