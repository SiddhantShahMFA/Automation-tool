import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/encryption';

export interface JiraConfig {
    domain: string;
    email: string;
    apiToken: string;
}

export interface JiraProject {
    id: string;
    key: string;
    name: string;
}

export async function getJiraConfig(): Promise<JiraConfig> {
    const credential = await prisma.integrationCredential.findUnique({
        where: { type: 'jira' },
    });

    if (!credential) {
        throw new Error('Jira integration not configured.');
    }

    return JSON.parse(decrypt(credential.encryptedConfig)) as JiraConfig;
}

function getJiraAuthHeader(config: JiraConfig): string {
    const credentials = `${config.email}:${config.apiToken}`;
    return `Basic ${Buffer.from(credentials).toString('base64')}`;
}

export async function verifyJiraCredentials(
    domain: string,
    email: string,
    apiToken: string
): Promise<{ valid: boolean; error?: string }> {
    try {
        const url = `https://${domain}/rest/api/3/myself`;
        const auth = `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`;

        const res = await fetch(url, {
            headers: {
                Authorization: auth,
                Accept: 'application/json',
            },
        });

        if (!res.ok) {
            return { valid: false, error: `Jira API error: ${res.status} ${res.statusText}` };
        }

        return { valid: true };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { valid: false, error: `Verification failed: ${message}` };
    }
}

export async function getJiraProjects(domain: string, email: string, apiToken: string): Promise<JiraProject[]> {
    const url = `https://${domain}/rest/api/3/project`;
    const auth = `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`;

    const res = await fetch(url, {
        headers: {
            Authorization: auth,
            Accept: 'application/json',
        },
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch Jira projects: ${res.statusText}`);
    }

    const data = await res.json();
    return data.map((p: Record<string, unknown>) => ({
        id: p.id as string,
        key: p.key as string,
        name: p.name as string,
    }));
}
export async function getJiraMyself(config: JiraConfig): Promise<{ accountId: string }> {
    const auth = getJiraAuthHeader(config);
    const url = `https://${config.domain}/rest/api/3/myself`;
    const res = await fetch(url, {
        headers: { Authorization: auth, Accept: 'application/json' },
    });
    if (!res.ok) {
        throw new Error(`Failed to fetch Jira profile: ${res.statusText}`);
    }
    const data = await res.json();
    return { accountId: data.accountId };
}

export async function createJiraProject(
    config: JiraConfig,
    name: string,
    key: string,
    leadAccountId: string
): Promise<JiraProject> {
    const auth = getJiraAuthHeader(config);
    const url = `https://${config.domain}/rest/api/3/project`;

    // Using a simplified scrum template for software projects
    const payload = {
        key: key.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10),
        name: name,
        projectTypeKey: 'software',
        projectTemplateKey: 'com.pyxis.greenhopper.jira:gh-simplified-scrum-classic',
        description: 'Auto-generated project space from PRD Autopilot',
        leadAccountId: leadAccountId,
        assigneeType: 'PROJECT_LEAD'
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: auth,
            Accept: 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Failed to create Jira project: ${res.status} ${res.statusText} - ${errText}`);
    }

    const data = await res.json();
    return {
        id: data.id as string,
        key: data.key as string,
        name: name
    };
}
export interface JiraDraftTicket {
    action?: 'CREATE' | 'UPDATE' | 'DELETE' | 'KEEP';
    issueKey?: string;
    type: 'Epic' | 'Story';
    summary: string;
    description: string;
}

export async function syncJiraTickets(
    config: JiraConfig,
    projectKey: string,
    tickets: JiraDraftTicket[]
): Promise<string[]> {
    const authHeader = getJiraAuthHeader(config);
    const activeIssueKeys: string[] = [];
    let epicKey: string | null = null;

    // Convert to Jira Document Format (Atlassian Document Format) for description
    const createAdfDescription = (text: string) => {
        return {
            type: "doc",
            version: 1,
            content: [
                {
                    type: "paragraph",
                    content: [
                        {
                            type: "text",
                            text: text || ""
                        }
                    ]
                }
            ]
        };
    };

    // Process Epic first (if any CREATE/UPDATE)
    const epic = tickets.find((t) => t.type === 'Epic');

    if (epic) {
        if (epic.action === 'CREATE' || !epic.action) {
            const payload = {
                fields: {
                    project: { key: projectKey },
                    summary: epic.summary,
                    description: createAdfDescription(epic.description),
                    issuetype: { name: 'Epic' },
                },
            };

            const res = await fetch(`https://${config.domain}/rest/api/3/issue`, {
                method: 'POST',
                headers: {
                    Authorization: authHeader,
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errBody = await res.text();
                throw new Error(`Failed to create Epic: ${res.status} ${res.statusText} - ${errBody}`);
            }

            const data = await res.json();
            epicKey = data.key;
            activeIssueKeys.push(epicKey!);
        } else if (epic.action === 'UPDATE' && epic.issueKey) {
            const payload = {
                fields: {
                    summary: epic.summary,
                    description: createAdfDescription(epic.description),
                },
            };

            const res = await fetch(`https://${config.domain}/rest/api/3/issue/${epic.issueKey}`, {
                method: 'PUT',
                headers: {
                    Authorization: authHeader,
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errBody = await res.text();
                throw new Error(`Failed to update Epic ${epic.issueKey}: ${errBody}`);
            }
            epicKey = epic.issueKey;
            activeIssueKeys.push(epicKey);
        } else if (epic.action === 'KEEP' && epic.issueKey) {
            epicKey = epic.issueKey;
            activeIssueKeys.push(epicKey);
        }
        // If DELETE, we don't track it anymore locally, and could optionally trigger a Jira transition
    }

    // Process Stories
    const stories = tickets.filter((t) => t.type === 'Story');
    for (const story of stories) {
        if (story.action === 'CREATE' || !story.action) {
            const payload: { fields: Record<string, unknown> } = {
                fields: {
                    project: { key: projectKey },
                    summary: story.summary,
                    description: createAdfDescription(story.description),
                    issuetype: { name: 'Story' },
                },
            };

            if (epicKey) {
                payload.fields.parent = { key: epicKey };
            }

            const res = await fetch(`https://${config.domain}/rest/api/3/issue`, {
                method: 'POST',
                headers: {
                    Authorization: authHeader,
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                console.error(`Failed to create Story: ${story.summary}`, await res.text());
            } else {
                const data = await res.json();
                activeIssueKeys.push(data.key);
                story.issueKey = data.key; // Store key back for UI
            }
        } else if (story.action === 'UPDATE' && story.issueKey) {
            const payload = {
                fields: {
                    summary: story.summary,
                    description: createAdfDescription(story.description),
                },
            };

            const res = await fetch(`https://${config.domain}/rest/api/3/issue/${story.issueKey}`, {
                method: 'PUT',
                headers: {
                    Authorization: authHeader,
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                console.error(`Failed to update Story: ${story.issueKey}`, await res.text());
            } else {
                activeIssueKeys.push(story.issueKey);
            }
        } else if (story.action === 'KEEP' && story.issueKey) {
            activeIssueKeys.push(story.issueKey);
        } else if (story.action === 'DELETE' && story.issueKey) {
            // Optional: Transition issue to Done/Closed using Jira API.
            // For now, we'll just omit it from the active list.
        }
    }

    return activeIssueKeys;
}
