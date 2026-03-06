'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Phase = 'input' | 'clarify' | 'generating' | 'review';

interface Question {
    id: string;
    question: string;
    required: boolean;
    orderNum: number;
}

interface PrdContent {
    title: string;
    overview: string;
    goals: string[];
    targetUsers: Array<{ persona: string; description: string }>;
    scope: { inScope: string[]; outOfScope: string[] };
    functionalRequirements: Array<{ id: string; title: string; description: string; priority: string }>;
    nonFunctionalRequirements: Array<{ id: string; title: string; description: string }>;
    openQuestions: string[];
    assumptions: string[];
    changeLog: Array<{ version: string; date: string; changes: string }>;
}

export default function CreatePrdPage() {
    const router = useRouter();
    const [phase, setPhase] = useState<Phase>('input');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Input phase
    const [title, setTitle] = useState('');
    const [rawInput, setRawInput] = useState('');

    // Clarify phase
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [prdDocumentId, setPrdDocumentId] = useState<string | null>(null);
    const [projectId, setProjectId] = useState<string | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [answers, setAnswers] = useState<Record<string, string>>({});

    // Review phase
    const [prdContent, setPrdContent] = useState<PrdContent | null>(null);
    const [publishing, setPublishing] = useState(false);
    const [publishResult, setPublishResult] = useState<{ notionPageUrl: string } | null>(null);

    const handleSubmitInput = async () => {
        setError(null);
        setLoading(true);
        try {
            const res = await fetch('/api/prds/create/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, rawInput }),
            });
            const data = await res.json();
            if (data.error) {
                setError(data.error);
                return;
            }
            setSessionId(data.sessionId);
            setPrdDocumentId(data.prdDocumentId);
            setProjectId(data.projectId);
            setQuestions(data.questions);
            setPhase('clarify');
        } catch {
            setError('Failed to create session');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitAnswers = async () => {
        if (!sessionId) return;
        setError(null);
        setLoading(true);
        try {
            // Save answers
            const answerPayload = Object.entries(answers).map(([questionId, text]) => ({
                questionId,
                text,
            }));

            const answerRes = await fetch(`/api/sessions/${sessionId}/answers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ answers: answerPayload }),
            });
            const answerData = await answerRes.json();
            if (answerData.error) {
                setError(answerData.error);
                return;
            }

            if (!answerData.allRequiredAnswered) {
                setError('Please answer all required questions before continuing');
                return;
            }

            // Generate PRD
            setPhase('generating');
            const genRes = await fetch(`/api/sessions/${sessionId}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const genData = await genRes.json();
            if (genData.error) {
                setError(genData.error);
                setPhase('clarify');
                return;
            }

            setPrdContent(genData.prdContent);
            if (genData.prdDocumentId) setPrdDocumentId(genData.prdDocumentId);
            setPhase('review');
        } catch {
            setError('Failed to generate PRD');
            setPhase('clarify');
        } finally {
            setLoading(false);
        }
    };

    const handlePublish = async () => {
        if (!prdDocumentId) return;
        setError(null);
        setPublishing(true);
        try {
            const res = await fetch(`/api/prds/${prdDocumentId}/publish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await res.json();
            if (data.error) {
                setError(data.error);
                return;
            }
            setPublishResult({ notionPageUrl: data.notionPageUrl });
        } catch {
            setError('Failed to publish to Notion');
        } finally {
            setPublishing(false);
        }
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <h1>
                    {phase === 'input' && 'Create PRD'}
                    {phase === 'clarify' && 'Clarification Questions'}
                    {phase === 'generating' && 'Generating PRD...'}
                    {phase === 'review' && 'Review PRD Draft'}
                </h1>
                <p>
                    {phase === 'input' && 'Paste your notes, transcript, or context material'}
                    {phase === 'clarify' && 'Answer these questions to help AI produce a better PRD'}
                    {phase === 'generating' && 'AI is analyzing your input and generating the PRD'}
                    {phase === 'review' && 'Review the generated PRD before publishing to Notion'}
                </p>
            </div>

            {/* Progress indicator */}
            <div className="steps-indicator" style={{ marginBottom: 'var(--sp-2xl)' }}>
                {['Input', 'Clarify', 'Generate', 'Review'].map((label, idx) => {
                    const phaseMap = ['input', 'clarify', 'generating', 'review'];
                    const currentIdx = phaseMap.indexOf(phase);
                    return (
                        <div key={label} style={{ display: 'contents' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div className={`step-dot ${idx < currentIdx ? 'step-dot-completed' : idx === currentIdx ? 'step-dot-active' : 'step-dot-inactive'
                                    }`}>
                                    {idx < currentIdx ? '✓' : idx + 1}
                                </div>
                                <span className="step-label">{label}</span>
                            </div>
                            {idx < 3 && (
                                <div className={`step-connector ${idx < currentIdx ? 'step-connector-completed' : ''}`} />
                            )}
                        </div>
                    );
                })}
            </div>

            {error && <div className="alert alert-error">⚠️ {error}</div>}

            {/* Phase 1: Input */}
            {phase === 'input' && (
                <div className="card">
                    <div className="form-group">
                        <label className="form-label">PRD Title (optional)</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="e.g. User Onboarding Redesign"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Source Material</label>
                        <textarea
                            className="form-textarea form-textarea-large"
                            placeholder="Paste your meeting notes, transcript, feature spec, email thread, or any context material here...

The more detail you provide, the better the generated PRD will be. You can include:
• Meeting transcripts
• Feature ideas and requirements
• User feedback or research notes
• Technical constraints
• Business context"
                            value={rawInput}
                            onChange={(e) => setRawInput(e.target.value)}
                        />
                        <span className="form-hint">
                            {rawInput.length} characters · Minimum 10 required
                        </span>
                    </div>
                    <div className="flex gap-md">
                        <button className="btn btn-secondary" onClick={() => router.push('/projects')}>
                            Cancel
                        </button>
                        <button
                            className="btn btn-primary btn-lg"
                            onClick={handleSubmitInput}
                            disabled={loading || rawInput.trim().length < 10}
                        >
                            {loading ? <span className="spinner" /> : null}
                            Analyze &amp; Continue →
                        </button>
                    </div>
                </div>
            )}

            {/* Phase 2: Clarification Questions */}
            {phase === 'clarify' && (
                <div>
                    {questions.map((q) => (
                        <div key={q.id} className="question-card">
                            <div className="question-number">
                                Question {q.orderNum} {q.required && <span style={{ color: 'var(--danger)' }}>*</span>}
                            </div>
                            <div className="question-text">{q.question}</div>
                            <textarea
                                className="question-input"
                                placeholder="Type your answer..."
                                value={answers[q.id] || ''}
                                onChange={(e) =>
                                    setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                                }
                            />
                        </div>
                    ))}
                    <div className="flex gap-md mt-lg">
                        <button className="btn btn-secondary" onClick={() => setPhase('input')}>
                            ← Back to Input
                        </button>
                        <button
                            className="btn btn-primary btn-lg"
                            onClick={handleSubmitAnswers}
                            disabled={loading}
                        >
                            {loading ? <span className="spinner" /> : null}
                            Generate PRD →
                        </button>
                    </div>
                </div>
            )}

            {/* Phase 3: Generating */}
            {phase === 'generating' && (
                <div className="card text-center" style={{ padding: 'var(--sp-3xl)' }}>
                    <div className="spinner spinner-lg" style={{ margin: '0 auto var(--sp-xl)' }} />
                    <h3>AI is generating your PRD...</h3>
                    <p className="text-secondary mt-md">
                        This may take 30-60 seconds depending on the complexity of your input.
                    </p>
                </div>
            )}

            {/* Phase 4: Review */}
            {phase === 'review' && prdContent && (
                <div>
                    {publishResult ? (
                        <div className="alert alert-success">
                            ✅ Published to Notion!{' '}
                            <a href={publishResult.notionPageUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
                                Open in Notion →
                            </a>
                        </div>
                    ) : null}

                    <div className="card" style={{ marginBottom: 'var(--sp-xl)' }}>
                        <div className="prd-section">
                            <h2>{prdContent.title}</h2>
                        </div>

                        <div className="prd-section">
                            <h2>Overview</h2>
                            <p>{prdContent.overview}</p>
                        </div>

                        <div className="prd-section">
                            <h2>Goals</h2>
                            <ul>
                                {prdContent.goals?.map((g, i) => (
                                    <li key={i}>{g}</li>
                                ))}
                            </ul>
                        </div>

                        <div className="prd-section">
                            <h2>Target Users</h2>
                            {prdContent.targetUsers?.map((u, i) => (
                                <div key={i} style={{ marginBottom: 'var(--sp-md)' }}>
                                    <h3>{u.persona}</h3>
                                    <p>{u.description}</p>
                                </div>
                            ))}
                        </div>

                        <div className="prd-section">
                            <h2>Scope</h2>
                            <h3>In Scope</h3>
                            <ul>
                                {prdContent.scope?.inScope?.map((s, i) => (
                                    <li key={i}>{s}</li>
                                ))}
                            </ul>
                            <h3 style={{ marginTop: 'var(--sp-md)' }}>Out of Scope</h3>
                            <ul>
                                {prdContent.scope?.outOfScope?.map((s, i) => (
                                    <li key={i}>{s}</li>
                                ))}
                            </ul>
                        </div>

                        <div className="prd-section">
                            <h2>Functional Requirements</h2>
                            {prdContent.functionalRequirements?.map((r) => (
                                <div key={r.id} style={{ marginBottom: 'var(--sp-md)' }}>
                                    <h3>
                                        {r.id}: {r.title}{' '}
                                        <span className="badge badge-accent">{r.priority}</span>
                                    </h3>
                                    <p>{r.description}</p>
                                </div>
                            ))}
                        </div>

                        <div className="prd-section">
                            <h2>Non-Functional Requirements</h2>
                            {prdContent.nonFunctionalRequirements?.map((r) => (
                                <div key={r.id} style={{ marginBottom: 'var(--sp-md)' }}>
                                    <h3>
                                        {r.id}: {r.title}
                                    </h3>
                                    <p>{r.description}</p>
                                </div>
                            ))}
                        </div>

                        <div className="prd-section">
                            <h2>Open Questions</h2>
                            <ul>
                                {prdContent.openQuestions?.map((q, i) => (
                                    <li key={i}>{q}</li>
                                ))}
                            </ul>
                        </div>

                        <div className="prd-section">
                            <h2>Assumptions</h2>
                            <ul>
                                {prdContent.assumptions?.map((a, i) => (
                                    <li key={i}>{a}</li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    <div className="flex gap-md">
                        <button className="btn btn-secondary" onClick={() => router.push('/projects')}>
                            Save as Draft
                        </button>
                        {!publishResult && (
                            <button
                                className="btn btn-primary btn-lg"
                                onClick={handlePublish}
                                disabled={publishing}
                            >
                                {publishing ? <span className="spinner" /> : null}
                                Publish to Notion →
                            </button>
                        )}
                        {publishResult && (
                            <button
                                className="btn btn-primary btn-lg"
                                onClick={() => router.push(`/projects/${projectId}`)}
                            >
                                Go to Project →
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
