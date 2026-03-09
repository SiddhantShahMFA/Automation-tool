import { NextRequest, NextResponse } from 'next/server';
import { verifyJiraCredentials, getJiraProjects } from '@/lib/jira/client';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { domain, email, apiToken } = body;

        if (!domain || !email || !apiToken) {
            return NextResponse.json({ valid: false, error: 'Missing Jira credentials' }, { status: 400 });
        }

        // Clean domain
        const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');

        const verifyRes = await verifyJiraCredentials(cleanDomain, email, apiToken);
        if (!verifyRes.valid) {
            return NextResponse.json({ valid: false, error: verifyRes.error });
        }

        const projects = await getJiraProjects(cleanDomain, email, apiToken);

        return NextResponse.json({ valid: true, projects, cleanDomain });
    } catch (err: unknown) {
        return NextResponse.json(
            { valid: false, error: err instanceof Error ? err.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
