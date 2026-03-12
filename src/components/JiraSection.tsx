'use client';

import { useCallback, useEffect, useState } from 'react';

interface JiraTicketAction {
    id?: string;
    action?: 'CREATE' | 'UPDATE' | 'KEEP' | 'CLOSE' | 'DELETE';
    issueKey?: string;
    projectKey?: string | null;
    type: 'Epic' | 'Story';
    summary: string;
    description: string;
    requirementIds?: string[];
}

interface JiraSectionProps {
    prdDocumentId: string;
    projectId: string;
    existingTickets: JiraTicketAction[] | null;
    publishedUrls: string[] | null;
    artifactVersionId: string | null;
    defaultWorkspaceJiraProjectKey: string | null;
    savedJiraProjectKey: string | null;
}

export default function JiraSection({
    prdDocumentId,
    projectId,
    existingTickets,
    publishedUrls,
    artifactVersionId,
    defaultWorkspaceJiraProjectKey,
    savedJiraProjectKey,
}: JiraSectionProps) {
    const getActionId = (ticket: JiraTicketAction, index: number) =>
        ticket.id || ticket.issueKey || `${ticket.type}-${ticket.summary}-${index}`;

    const [tickets, setTickets] = useState<JiraTicketAction[] | null>(existingTickets);
    const [urls, setUrls] = useState<string[] | null>(publishedUrls);
    const [deltaArtifactVersionId, setDeltaArtifactVersionId] = useState<string | null>(artifactVersionId);
    const [selectedActionIds, setSelectedActionIds] = useState<string[]>(
        existingTickets?.map((ticket, index) => getActionId(ticket, index)) || []
    );
    const [generating, setGenerating] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [activeJiraProjectKey, setActiveJiraProjectKey] = useState<string | null>(
        savedJiraProjectKey || defaultWorkspaceJiraProjectKey
    );
    const [availableProjects, setAvailableProjects] = useState<Array<{ id: string; key: string; name: string }>>([]);
    const [loadingProjects, setLoadingProjects] = useState(false);
    const [isEditingSpace, setIsEditingSpace] = useState(!savedJiraProjectKey);
    const [isCreatingSpace, setIsCreatingSpace] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectKey, setNewProjectKey] = useState('');
    const [publishCountdown, setPublishCountdown] = useState<number | null>(null);

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
            await fetch(`/api/projects/${projectId}/jira`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jiraProjectKey: createdProjectKey }),
            });

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
            const res = await fetch('/api/jira/generate-delta', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prdDocumentId, targetProjectKey: activeJiraProjectKey }),
            });
            const data = await res.json();
            if (!data.success) {
                setError(data.error || 'Failed to generate Jira delta');
                return;
            }

            const actions = data.actions || data.tickets || [];
            setTickets(actions);
            setUrls(null);
            setDeltaArtifactVersionId(data.artifactVersionId || null);
            setSelectedActionIds(actions.map((ticket: JiraTicketAction, index: number) => getActionId(ticket, index)));
        } catch {
            setError('Error generating Jira delta');
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

    const toggleSelection = (actionId: string) => {
        setSelectedActionIds((current) =>
            current.includes(actionId)
                ? current.filter((id) => id !== actionId)
                : [...current, actionId]
        );
    };

    const handlePublish = useCallback(async () => {
        setError(null);
        setPublishing(true);
        try {
            const res = await fetch('/api/jira/publish-delta', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prdDocumentId,
                    targetProjectKey: activeJiraProjectKey,
                    artifactVersionId: deltaArtifactVersionId,
                    approvedActionIds: selectedActionIds,
                }),
            });
            const data = await res.json();
            if (!data.success) {
                setError(data.error || 'Failed to publish Jira delta');
                return;
            }
            setUrls(data.urls);
        } catch {
            setError('Error publishing Jira delta');
        } finally {
            setPublishing(false);
        }
    }, [activeJiraProjectKey, deltaArtifactVersionId, prdDocumentId, selectedActionIds]);

    useEffect(() => {
        if (publishCountdown === null) return;
        if (publishCountdown === 0) {
            setPublishCountdown(null);
            void handlePublish();
            return;
        }
        const timer = setTimeout(() => setPublishCountdown(publishCountdown - 1), 1000);
        return () => clearTimeout(timer);
    }, [handlePublish, publishCountdown]);

    const selectedCount = selectedActionIds.length;

    return (
        <div className="card mt-lg" style={{ marginTop: 'var(--sp-xl)' }}>
            <div className="card-header">
                <h2>Jira Delta Review</h2>
                <div className="flex gap-sm">
                    {!tickets && !urls && <span className="badge badge-default">Not Generated</span>}
                    {tickets && !urls && <span className="badge badge-warning">Draft Ready</span>}
                    {urls && <span className="badge badge-success">Published</span>}
                </div>
            </div>

            <div className="mb-lg p-md" style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                <div className="flex items-center justify-between mb-sm">
                    <h3 style={{ fontSize: '1rem', margin: 0 }}>Target Jira Space</h3>
                    {!isEditingSpace ? (
                        <button className="btn btn-sm btn-ghost" onClick={() => {
                            setIsEditingSpace(true);
                            void fetchProjects();
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
                            placeholder="Project Name"
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                            disabled={loadingProjects}
                        />
                        <div className="flex gap-sm">
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Project Key"
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
                                {availableProjects.map((project) => (
                                    <option key={project.key} value={project.key}>
                                        {project.name} ({project.key})
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

            {error && <div className="alert alert-error mb-md">Warning: {error}</div>}

            {!tickets && !urls && (
                <div className="flex gap-md">
                    <button
                        className="btn btn-primary"
                        onClick={handleGenerate}
                        disabled={generating || !activeJiraProjectKey}
                    >
                        {generating ? <span className="spinner" /> : null}
                        Generate Jira Delta
                    </button>
                    {!activeJiraProjectKey && !isEditingSpace && (
                        <span className="text-secondary" style={{ alignSelf: 'center', color: 'var(--color-error)' }}>
                            Please select a Jira space first.
                        </span>
                    )}
                </div>
            )}

            {tickets && (
                <div className="mt-md">
                    <p className="text-secondary mb-md">
                        Review the drafted delta and choose which actions should be published.
                    </p>

                    <div className="flex flex-col gap-sm mb-lg">
                        {tickets.map((ticket, index) => {
                            const actionId = getActionId(ticket, index);
                            const selected = selectedActionIds.includes(actionId);
                            return (
                                <div key={actionId} className="card" style={{ padding: 'var(--sp-md)' }}>
                                    <div className="flex items-center justify-between gap-sm mb-sm">
                                        <div className="flex items-center gap-sm">
                                            <input
                                                type="checkbox"
                                                checked={selected}
                                                onChange={() => toggleSelection(actionId)}
                                            />
                                            <span className={`badge ${ticket.type === 'Epic' ? 'badge-accent' : 'badge-default'}`}>
                                                {ticket.type}
                                            </span>
                                            <span className="badge badge-warning">{ticket.action || 'CREATE'}</span>
                                            <strong style={{ fontSize: '1.1rem' }}>{ticket.summary}</strong>
                                        </div>
                                        {ticket.issueKey && (
                                            <span className="text-secondary text-sm">{ticket.issueKey}</span>
                                        )}
                                    </div>
                                    <p className="text-secondary text-sm" style={{ whiteSpace: 'pre-wrap' }}>
                                        {ticket.description}
                                    </p>
                                    {ticket.requirementIds && ticket.requirementIds.length > 0 && (
                                        <p className="text-secondary text-sm" style={{ marginTop: 'var(--sp-sm)' }}>
                                            Linked requirements: {ticket.requirementIds.join(', ')}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex gap-md" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                            className="btn btn-secondary"
                            onClick={async () => {
                                await handleGenerate();
                            }}
                            disabled={generating || publishing}
                        >
                            {generating ? <span className="spinner" /> : null}
                            Regenerate Delta
                        </button>

                        {!urls ? (
                            publishCountdown !== null ? (
                                <div className="flex items-center gap-sm">
                                    <button
                                        className="btn btn-primary"
                                        onClick={cancelPublish}
                                    >
                                        Undo Publish ({publishCountdown}s)
                                    </button>
                                    <span className="text-secondary text-sm">Waiting to publish {selectedCount} actions...</span>
                                </div>
                            ) : (
                                <button
                                    className="btn btn-primary"
                                    onClick={startPublishCountdown}
                                    disabled={publishing || generating || !activeJiraProjectKey || selectedCount === 0}
                                >
                                    {publishing ? <span className="spinner" /> : null}
                                    Publish Approved Actions ({selectedCount})
                                </button>
                            )
                        ) : (
                            <div className="flex items-center gap-sm" style={{ flexWrap: 'wrap' }}>
                                <div className="alert alert-success" style={{ margin: 0, padding: 'var(--sp-xs) var(--sp-sm)' }}>
                                    Published to Jira
                                </div>
                                {urls.map((url, index) => (
                                    <a key={url} href={url} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost">
                                        Open Ticket {index + 1}
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
