import { NextRequest, NextResponse } from 'next/server';
import { getJiraConfig, getJiraProjects, createJiraProject, getJiraMyself } from '@/lib/jira/client';

export async function GET() {
    try {
        const config = await getJiraConfig();
        const projects = await getJiraProjects(config.domain, config.email, config.apiToken);
        return NextResponse.json({ success: true, projects });
    } catch (err: unknown) {
        return NextResponse.json(
            { success: false, error: err instanceof Error ? err.message : 'Unknown error fetching Jira projects' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, key } = body;

        if (!name || !key) {
            return NextResponse.json({ success: false, error: 'Project name and key are required' }, { status: 400 });
        }

        const config = await getJiraConfig();

        // Fetch the user's account ID to set as project lead
        const myself = await getJiraMyself(config);

        const newProject = await createJiraProject(config, name, key, myself.accountId);

        return NextResponse.json({ success: true, project: newProject });
    } catch (err: unknown) {
        return NextResponse.json(
            { success: false, error: err instanceof Error ? err.message : 'Unknown error creating Jira project' },
            { status: 500 }
        );
    }
}
