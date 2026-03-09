'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Step = 'notion' | 'database' | 'model' | 'jira' | 'workspace';

interface NotionDatabase {
    id: string;
    title: string;
}

export default function SetupPage() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState<Step>('notion');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Notion state
    const [notionToken, setNotionToken] = useState('');
    const [databases, setDatabases] = useState<NotionDatabase[]>([]);
    const [selectedDbId, setSelectedDbId] = useState('');

    // Model state
    const [modelBaseUrl, setModelBaseUrl] = useState('https://api.openai.com/v1');
    const [modelApiKey, setModelApiKey] = useState('');
    const [modelName, setModelName] = useState('gpt-4o');
    const [modelHeaders, setModelHeaders] = useState('');

    // Jira state
    const [jiraDomain, setJiraDomain] = useState('');
    const [jiraEmail, setJiraEmail] = useState('');
    const [jiraToken, setJiraToken] = useState('');
    const [jiraVerified, setJiraVerified] = useState(false);
    const [jiraProjects, setJiraProjects] = useState<{ id: string, key: string, name: string }[]>([]);
    const [selectedJiraProject, setSelectedJiraProject] = useState('');

    // Workspace state
    const [companyName, setCompanyName] = useState('');

    const steps: { key: Step; label: string; number: number }[] = [
        { key: 'notion', label: 'Notion', number: 1 },
        { key: 'database', label: 'Database', number: 2 },
        { key: 'model', label: 'AI Model', number: 3 },
        { key: 'jira', label: 'Jira', number: 4 },
        { key: 'workspace', label: 'Workspace', number: 5 },
    ];

    const currentStepIndex = steps.findIndex((s) => s.key === currentStep);

    const clearMessages = () => {
        setError(null);
        setSuccess(null);
    };

    // Step 1: Verify Notion token
    const handleVerifyNotion = async () => {
        clearMessages();
        setLoading(true);
        try {
            const res = await fetch('/api/setup/notion/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: notionToken }),
            });
            const data = await res.json();
            if (data.valid) {
                setDatabases(data.databases || []);
                setSuccess('Notion connected successfully!');
                setCurrentStep('database');
            } else {
                setError(data.error || 'Verification failed');
            }
        } catch {
            setError('Failed to connect to server');
        } finally {
            setLoading(false);
        }
    };

    // Step 2: Save Notion credential + database selection
    const handleSaveNotion = async () => {
        if (!selectedDbId) {
            setError('Please select a database');
            return;
        }
        clearMessages();
        setLoading(true);
        try {
            const db = databases.find((d) => d.id === selectedDbId);
            const res = await fetch('/api/setup/notion/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: notionToken,
                    databaseId: selectedDbId,
                    databaseName: db?.title,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setSuccess('Database selected!');
                setCurrentStep('model');
            } else {
                setError(data.error || 'Failed to save');
            }
        } catch {
            setError('Failed to save Notion configuration');
        } finally {
            setLoading(false);
        }
    };

    // Step 3: Verify & save model config
    const handleVerifyModel = async () => {
        clearMessages();
        setLoading(true);
        try {
            const res = await fetch('/api/setup/model/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    baseUrl: modelBaseUrl,
                    apiKey: modelApiKey,
                    model: modelName,
                    headersJson: modelHeaders || undefined,
                }),
            });
            const data = await res.json();
            if (data.valid) {
                // Now save it
                const saveRes = await fetch('/api/setup/model/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        baseUrl: modelBaseUrl,
                        apiKey: modelApiKey,
                        model: modelName,
                        headersJson: modelHeaders || undefined,
                    }),
                });
                const saveData = await saveRes.json();
                if (saveData.success) {
                    setSuccess('Model provider connected!');
                    setCurrentStep('jira');
                } else {
                    setError(saveData.error || 'Failed to save model config');
                }
            } else {
                setError(data.error || 'Model verification failed');
            }
        } catch {
            setError('Failed to verify model');
        } finally {
            setLoading(false);
        }
    };

    // Step 4: Verify & save Jira config
    const handleVerifyJira = async () => {
        clearMessages();
        setLoading(true);
        try {
            const res = await fetch('/api/setup/jira/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    domain: jiraDomain,
                    email: jiraEmail,
                    apiToken: jiraToken,
                }),
            });
            const data = await res.json();
            if (data.valid) {
                setJiraProjects(data.projects || []);
                setJiraVerified(true);
                setSuccess('Jira verified! Please select a default project.');
            } else {
                setError(data.error || 'Jira verification failed');
            }
        } catch {
            setError('Failed to verify Jira');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveJira = async () => {
        if (!selectedJiraProject) {
            setError('Please select a Jira project');
            return;
        }
        clearMessages();
        setLoading(true);
        try {
            const saveRes = await fetch('/api/setup/jira/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    domain: jiraDomain,
                    email: jiraEmail,
                    apiToken: jiraToken,
                    projectKey: selectedJiraProject,
                }),
            });
            const saveData = await saveRes.json();
            if (saveData.success) {
                setSuccess('Jira connected!');
                setCurrentStep('workspace');
            } else {
                setError(saveData.error || 'Failed to save Jira config');
            }
        } catch {
            setError('Failed to save Jira');
        } finally {
            setLoading(false);
        }
    };

    // Step 5: Save workspace defaults
    const handleSaveWorkspace = async () => {
        clearMessages();
        setLoading(true);
        try {
            const res = await fetch('/api/setup/workspace/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyName }),
            });
            const data = await res.json();
            if (data.success) {
                setSuccess('Setup complete! Redirecting...');
                setTimeout(() => router.push('/projects'), 1500);
            } else {
                setError(data.error || 'Failed to save');
            }
        } catch {
            setError('Failed to save workspace settings');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <h1>Setup Workspace</h1>
                <p>Connect your integrations to get started with PRD Autopilot</p>
            </div>

            {/* Step Indicator */}
            <div className="steps-indicator">
                {steps.map((step, idx) => (
                    <div key={step.key} style={{ display: 'contents' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div
                                className={`step-dot ${idx < currentStepIndex
                                    ? 'step-dot-completed'
                                    : idx === currentStepIndex
                                        ? 'step-dot-active'
                                        : 'step-dot-inactive'
                                    }`}
                            >
                                {idx < currentStepIndex ? '✓' : step.number}
                            </div>
                            <span className="step-label">{step.label}</span>
                        </div>
                        {idx < steps.length - 1 && (
                            <div
                                className={`step-connector ${idx < currentStepIndex ? 'step-connector-completed' : ''
                                    }`}
                            />
                        )}
                    </div>
                ))}
            </div>

            {/* Messages */}
            {error && <div className="alert alert-error">⚠️ {error}</div>}
            {success && <div className="alert alert-success">✅ {success}</div>}

            {/* Step 1: Notion Token */}
            {currentStep === 'notion' && (
                <div className="card">
                    <div className="card-header">
                        <h2>Connect Notion</h2>
                        <span className="badge badge-accent">Required</span>
                    </div>
                    <p className="text-secondary mb-lg">
                        Create a{' '}
                        <a href="https://www.notion.so/my-integrations" target="_blank" rel="noreferrer">
                            Notion internal integration
                        </a>{' '}
                        and paste the token below. Make sure to share your PRD database with the integration.
                    </p>
                    <div className="form-group">
                        <label className="form-label">Integration Token</label>
                        <input
                            type="password"
                            className="form-input"
                            placeholder="ntn_..."
                            value={notionToken}
                            onChange={(e) => setNotionToken(e.target.value)}
                        />
                        <span className="form-hint">
                            Found in your integration settings → Internal Integration Token
                        </span>
                    </div>
                    <button
                        className="btn btn-primary btn-lg"
                        onClick={handleVerifyNotion}
                        disabled={loading || !notionToken}
                    >
                        {loading ? <span className="spinner" /> : null}
                        Verify &amp; Connect
                    </button>
                </div>
            )}

            {/* Step 2: Database Selection */}
            {currentStep === 'database' && (
                <div className="card">
                    <div className="card-header">
                        <h2>Select PRD Database</h2>
                        <span className="badge badge-success">Notion Connected</span>
                    </div>
                    <p className="text-secondary mb-lg">
                        Choose the Notion database where PRDs will be created. The app will use this as the
                        canonical PRD registry.
                    </p>
                    {databases.length > 0 ? (
                        <>
                            <div className="form-group">
                                <label className="form-label">Available Databases</label>
                                <select
                                    className="form-select"
                                    value={selectedDbId}
                                    onChange={(e) => setSelectedDbId(e.target.value)}
                                >
                                    <option value="">Select a database...</option>
                                    {databases.map((db) => (
                                        <option key={db.id} value={db.id}>
                                            {db.title}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-md">
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => setCurrentStep('notion')}
                                >
                                    ← Back
                                </button>
                                <button
                                    className="btn btn-primary btn-lg"
                                    onClick={handleSaveNotion}
                                    disabled={loading || !selectedDbId}
                                >
                                    {loading ? <span className="spinner" /> : null}
                                    Continue
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="alert alert-warning">
                            No databases found. Make sure you&apos;ve shared at least one database with your Notion
                            integration.
                        </div>
                    )}
                </div>
            )}

            {/* Step 3: Model Provider */}
            {currentStep === 'model' && (
                <div className="card">
                    <div className="card-header">
                        <h2>Configure AI Model</h2>
                        <span className="badge badge-accent">Required</span>
                    </div>
                    <p className="text-secondary mb-lg">
                        Connect an OpenAI-compatible model provider. This will be used for PRD generation and
                        clarification questions.
                    </p>
                    <div className="form-group">
                        <label className="form-label">Base URL</label>
                        <input
                            type="url"
                            className="form-input"
                            placeholder="https://api.openai.com/v1"
                            value={modelBaseUrl}
                            onChange={(e) => setModelBaseUrl(e.target.value)}
                        />
                        <span className="form-hint">
                            OpenAI: https://api.openai.com/v1 · Anthropic via proxy, Ollama, etc.
                        </span>
                    </div>
                    <div className="form-group">
                        <label className="form-label">API Key</label>
                        <input
                            type="password"
                            className="form-input"
                            placeholder="sk-..."
                            value={modelApiKey}
                            onChange={(e) => setModelApiKey(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Model Name</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="gpt-4o"
                            value={modelName}
                            onChange={(e) => setModelName(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Custom Headers (optional JSON)</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder='{"X-Custom-Header": "value"}'
                            value={modelHeaders}
                            onChange={(e) => setModelHeaders(e.target.value)}
                        />
                        <span className="form-hint">
                            Additional headers for the API request, as a JSON object
                        </span>
                    </div>
                    <div className="flex gap-md">
                        <button
                            className="btn btn-secondary"
                            onClick={() => setCurrentStep('database')}
                        >
                            ← Back
                        </button>
                        <button
                            className="btn btn-primary btn-lg"
                            onClick={handleVerifyModel}
                            disabled={loading || !modelBaseUrl || !modelApiKey || !modelName}
                        >
                            {loading ? <span className="spinner" /> : null}
                            Verify &amp; Save
                        </button>
                    </div>
                </div>
            )}

            {/* Step 4: Jira config */}
            {currentStep === 'jira' && (
                <div className="card">
                    <div className="card-header">
                        <h2>Connect Jira</h2>
                        <span className="badge badge-default">Optional</span>
                    </div>
                    <p className="text-secondary mb-lg">
                        Connect Jira to generate Epic and Story tickets from your PRDs. Leave blank if you don&apos;t want to use Jira.
                    </p>
                    <div className="form-group">
                        <label className="form-label">Jira Domain</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="your-company.atlassian.net"
                            value={jiraDomain}
                            onChange={(e) => setJiraDomain(e.target.value.replace(/^https?:\/\//, '').replace(/\/$/, ''))}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Jira Email</label>
                        <input
                            type="email"
                            className="form-input"
                            placeholder="you@company.com"
                            value={jiraEmail}
                            onChange={(e) => setJiraEmail(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Jira API Token</label>
                        <input
                            type="password"
                            className="form-input"
                            placeholder="ATATT..."
                            value={jiraToken}
                            onChange={(e) => setJiraToken(e.target.value)}
                        />
                    </div>

                    {jiraVerified && jiraProjects.length > 0 && (
                        <div className="form-group mt-md">
                            <label className="form-label">Default Project</label>
                            <select
                                className="form-select"
                                value={selectedJiraProject}
                                onChange={(e) => setSelectedJiraProject(e.target.value)}
                            >
                                <option value="">Select a project...</option>
                                {jiraProjects.map((p) => (
                                    <option key={p.key} value={p.key}>
                                        {p.name} ({p.key})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="flex gap-md">
                        <button
                            className="btn btn-secondary"
                            onClick={() => setCurrentStep('model')}
                        >
                            ← Back
                        </button>

                        {!jiraVerified ? (
                            <>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => setCurrentStep('workspace')}
                                >
                                    Skip Jira
                                </button>
                                <button
                                    className="btn btn-primary btn-lg"
                                    onClick={handleVerifyJira}
                                    disabled={loading || !jiraDomain || !jiraEmail || !jiraToken}
                                >
                                    {loading ? <span className="spinner" /> : null}
                                    Verify Jira
                                </button>
                            </>
                        ) : (
                            <button
                                className="btn btn-primary btn-lg"
                                onClick={handleSaveJira}
                                disabled={loading || !selectedJiraProject}
                            >
                                {loading ? <span className="spinner" /> : null}
                                Save &amp; Continue
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Step 5: Workspace Defaults */}
            {currentStep === 'workspace' && (
                <div className="card">
                    <div className="card-header">
                        <h2>Workspace Settings</h2>
                        <span className="badge badge-default">Optional</span>
                    </div>
                    <p className="text-secondary mb-lg">
                        Set your workspace defaults. These can be changed later.
                    </p>
                    <div className="form-group">
                        <label className="form-label">Company / Team Name</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Acme Corp"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                        />
                        <span className="form-hint">
                            Used as context in AI-generated PRDs
                        </span>
                    </div>

                    <div className="card" style={{ marginTop: 'var(--sp-lg)', background: 'var(--bg-tertiary)' }}>
                        <h3 style={{ marginBottom: 'var(--sp-md)' }}>Setup Summary</h3>
                        <div className="flex flex-col gap-sm">
                            <div className="flex items-center gap-md">
                                <span className="badge badge-success">✓</span>
                                <span>Notion connected</span>
                            </div>
                            <div className="flex items-center gap-md">
                                <span className="badge badge-success">✓</span>
                                <span>PRD database selected</span>
                            </div>
                            <div className="flex items-center gap-md">
                                <span className="badge badge-success">✓</span>
                                <span>AI model configured ({modelName})</span>
                            </div>
                            {jiraVerified && (
                                <div className="flex items-center gap-md">
                                    <span className="badge badge-success">✓</span>
                                    <span>Jira connected ({selectedJiraProject})</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-md mt-lg">
                        <button
                            className="btn btn-secondary"
                            onClick={() => setCurrentStep('jira')}
                        >
                            ← Back
                        </button>
                        <button
                            className="btn btn-primary btn-lg"
                            onClick={handleSaveWorkspace}
                            disabled={loading}
                        >
                            {loading ? <span className="spinner" /> : null}
                            Complete Setup →
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
