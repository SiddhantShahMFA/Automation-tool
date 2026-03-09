'use client';

import { useState, useEffect } from 'react';

interface JiraTicket {
    type: 'Epic' | 'Story';
    summary: string;
    description: string;
}

interface JiraSectionProps {
    prdDocumentId: string;
    projectId: string;
    existingTickets: JiraTicket[] | null;
    publishedUrls: string[] | null;
    defaultWorkspaceJiraProjectKey: string | null;
    savedJiraProjectKey: string | null;
}

export default function JiraSection({
    prdDocumentId,
    projectId,
    existingTickets,
    publishedUrls,
    defaultWorkspaceJiraProjectKey,
    savedJiraProjectKey,
}: JiraSectionProps) {
    const [tickets, setTickets] = useState<JiraTicket[] | null>(existingTickets);
    const [urls, setUrls] = useState<string[] | null>(publishedUrls);
    const [generating, setGenerating] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Project Space State
    const [activeJiraProjectKey, setActiveJiraProjectKey] = useState<string | null>(
        savedJiraProjectKey || defaultWorkspaceJiraProjectKey
    );
    const [availableProjects, setAvailableProjects] = useState<{ id: string, key: string, name: string }[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(false);
    const [isEditingSpace, setIsEditingSpace] = useState(!savedJiraProjectKey);
    const [isCreatingSpace, setIsCreatingSpace] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectKey, setNewProjectKey] = useState('');
    const [publishCountdown, setPublishCountdown] = useState<number | null>(null);

    // Fetch available projects when editing space
    const fetchProjects = async () => {
        setLoadingProjects(true);
        try {
            const res = await fetch('/api/jira/projects');
            const data = await res.json();
            if (data.success) {
                setAvailableProjects(data.projects);
            }
        } catch (err) {
            console.error('Failed to fetch Jira projects', err);
        } finally {
            setLoadingProjects(false);
        }
    };

    useEffect(() => {
        if (isEditingSpace && availableProjects.length === 0) {
            fetchProjects();
        }
    }, [isEditingSpace, availableProjects.length]);

    useEffect(() => {
        if (publishCountdown === null) return;
        if (publishCountdown === 0) {
            setPublishCountdown(null);
            handlePublish();
            return;
        }
        const timer = setTimeout(() => {
            setPublishCountdown(publishCountdown - 1);
        }, 1000);
        return () => clearTimeout(timer);
    }, [publishCountdown]);

    const handleSaveSpace = async () => {
        if (!activeJiraProjectKey) return;
        setLoadingProjects(true);
        try {
            await fetch(`/api/projects/${projectId}/jira`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jiraProjectKey: activeJiraProjectKey }),
            });
            setIsEditingSpace(false);
            setIsCreatingSpace(false);
        } catch (err) {
            console.error('Failed to save project space', err);
        } finally {
            setLoadingProjects(false);
        }
    };

    const handleCreateSpace = async () => {
        if (!newProjectName || !newProjectKey) return;
        setLoadingProjects(true);
        setError(null);
        try {
            // 1. Create Jira Space
            const createRes = await fetch('/api/jira/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newProjectName, key: newProjectKey }),
            });
            const createData = await createRes.json();

            if (!createData.success) {
                setError(createData.error || 'Failed to create Jira space');
                setLoadingProjects(false);
                return;
            }

            const createdProjectKey = createData.project.key;

            // 2. Save it to the project
            await fetch(`/api/projects/${projectId}/jira`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jiraProjectKey: createdProjectKey }),
            });

            // 3. Update states
            setActiveJiraProjectKey(createdProjectKey);
            setIsEditingSpace(false);
            setIsCreatingSpace(false);
            setNewProjectName('');
            setNewProjectKey('');
        } catch (err) {
            console.error('Failed to create and save project space', err);
            setError('Failed to create project space.');
        } finally {
            setLoadingProjects(false);
        }
    };

    const handleGenerate = async () => {
        setError(null);
        setGenerating(true);
        try {
            const res = await fetch(`/api/jira/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prdDocumentId }),
            });
            const data = await res.json();
            if (!data.success) {
                setError(data.error || 'Failed to generate tickets');
                return;
            }
            setTickets(data.tickets);
        } catch {
            setError('Error generating tickets');
        } finally {
            setGenerating(false);
        }
    };

    const startPublishCountdown = () => {
        setPublishCountdown(30);
    };

    const cancelPublish = () => {
        setPublishCountdown(null);
    };

    const handlePublish = async () => {
        setError(null);
        setPublishing(true);
        try {
            const res = await fetch(`/api/jira/publish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prdDocumentId,
                    targetProjectKey: activeJiraProjectKey
                }),
            });
            const data = await res.json();
            if (!data.success) {
                setError(data.error || 'Failed to publish tickets');
                return;
            }
            setUrls(data.urls);
        } catch {
            setError('Error publishing tickets');
        } finally {
            setPublishing(false);
        }
    };

    return (
        <div className="card mt-lg" style={{ marginTop: 'var(--sp-xl)' }}>
            <div className="card-header">
                <h2>Jira Board</h2>
                <div className="flex gap-sm">
                    {!tickets && !urls && <span className="badge badge-default">Not Generated</span>}
                    {tickets && !urls && <span className="badge badge-warning">Drafts</span>}
                    {urls && <span className="badge badge-success">Published</span>}
                </div>
            </div>

            {/* Jira Space Selection */}
            <div className="mb-lg p-md" style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                <div className="flex items-center justify-between mb-sm">
                    <h3 style={{ fontSize: '1rem', margin: 0 }}>Target Jira Space</h3>
                    {!isEditingSpace ? (
                        <button className="btn btn-sm btn-ghost" onClick={() => {
                            setIsEditingSpace(true);
                            fetchProjects();
                        }}>
                            Change
                        </button>
                    ) : (
                        <button className="btn btn-sm btn-ghost" onClick={() => setIsEditingSpace(false)}>
                            Cancel
                        </button>
                    )}
                </div>

                {!isEditingSpace ? (
                    <div className="text-secondary flex items-center gap-sm">
                        <span className="badge badge-accent">{activeJiraProjectKey || 'None'}</span>
                        {savedJiraProjectKey ? '(Saved for this project)' : defaultWorkspaceJiraProjectKey ? '(Workspace default)' : '(No space selected)'}
                    </div>
                ) : isCreatingSpace ? (
                    <div className="flex flex-col gap-sm mt-sm" style={{ flex: 1 }}>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Project Name (e.g., My Software Team)"
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                            disabled={loadingProjects}
                        />
                        <div className="flex gap-sm">
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Project Key (e.g., SAM)"
                                value={newProjectKey}
                                onChange={(e) => setNewProjectKey(e.target.value)}
                                disabled={loadingProjects}
                                maxLength={10}
                                style={{ textTransform: 'uppercase', width: '120px' }}
                            />
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={handleCreateSpace}
                                disabled={loadingProjects || !newProjectName || !newProjectKey}
                            >
                                {loadingProjects ? 'Creating...' : 'Create & Save'}
                            </button>
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => setIsCreatingSpace(false)}
                                disabled={loadingProjects}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-sm mt-sm">
                        <div className="flex gap-sm">
                            <select
                                className="form-select"
                                value={activeJiraProjectKey || ''}
                                onChange={(e) => setActiveJiraProjectKey(e.target.value)}
                                disabled={loadingProjects}
                                style={{ flex: 1 }}
                            >
                                <option value="">Select a Jira Space...</option>
                                {availableProjects.map((p) => (
                                    <option key={p.key} value={p.key}>
                                        {p.name} ({p.key})
                                    </option>
                                ))}
                            </select>
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={handleSaveSpace}
                                disabled={loadingProjects || !activeJiraProjectKey}
                            >
                                {loadingProjects ? 'Saving...' : 'Save Space'}
                            </button>
                        </div>
                        <div>
                            <button
                                className="btn btn-sm btn-ghost text-secondary"
                                style={{ padding: 0 }}
                                onClick={() => setIsCreatingSpace(true)}
                                disabled={loadingProjects}
                            >
                                + Create New Jira Space
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {error && <div className="alert alert-error mb-md">⚠️ {error}</div>}

            {!tickets && !urls && (
                <div className="flex gap-md">
                    <button
                        className="btn btn-primary"
                        onClick={handleGenerate}
                        disabled={generating || !activeJiraProjectKey}
                    >
                        {generating ? <span className="spinner" /> : null}
                        Generate Jira Tickets
                    </button>
                    {(!activeJiraProjectKey && !isEditingSpace) && (
                        <span className="text-secondary" style={{ alignSelf: 'center', color: 'var(--color-error)' }}>
                            Please select a Jira space first.
                        </span>
                    )}
                </div>
            )}

            {tickets && (
                <div className="mt-md">
                    <p className="text-secondary mb-md">Drafted {tickets.filter(t => t.type === 'Epic').length} Epic and {tickets.filter(t => t.type === 'Story').length} Stories.</p>
                    <div className="flex flex-col gap-sm mb-lg">
                        {tickets.map((t, i) => (
                            <div key={i} className="card" style={{ padding: 'var(--sp-md)' }}>
                                <div className="flex items-center gap-sm mb-sm">
                                    <span className={`badge ${t.type === 'Epic' ? 'badge-accent' : 'badge-default'}`}>
                                        {t.type}
                                    </span>
                                    <strong style={{ fontSize: '1.1rem' }}>{t.summary}</strong>
                                </div>
                                <p className="text-secondary text-sm" style={{ whiteSpace: 'pre-wrap' }}>
                                    {t.description}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-md">
                        <button
                            className="btn btn-secondary"
                            onClick={async () => {
                                await handleGenerate();
                                setUrls(null); // Clear URLs if regenerated successfully
                            }}
                            disabled={generating || publishing}
                        >
                            {generating ? <span className="spinner" /> : null}
                            Regenerate Tickets
                        </button>

                        {!urls ? (
                            publishCountdown !== null ? (
                                <div className="flex items-center gap-sm">
                                    <button
                                        className="btn btn-primary bg-warning text-warning-content border-warning"
                                        onClick={cancelPublish}
                                    >
                                        Undo Push ({publishCountdown}s)
                                    </button>
                                    <span className="text-secondary text-sm">Waiting to push...</span>
                                </div>
                            ) : (
                                <button
                                    className="btn btn-primary"
                                    onClick={startPublishCountdown}
                                    disabled={publishing || generating || !activeJiraProjectKey}
                                >
                                    {publishing ? <span className="spinner" /> : null}
                                    Push to Jira
                                </button>
                            )
                        ) : (
                            <div className="flex items-center gap-sm">
                                <div className="alert alert-success" style={{ margin: 0, padding: 'var(--sp-xs) var(--sp-sm)' }}>
                                    ✅ Published to Jira!
                                </div>
                                {urls.map((u, i) => (
                                    <a key={i} href={u} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost" style={{ background: 'white' }}>
                                        Open Ticket {i + 1}
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
