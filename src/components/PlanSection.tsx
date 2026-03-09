'use client';

import { useState } from 'react';

interface PlanSectionProps {
    prdDocumentId: string;
    existingPlan: string | null;
}

export default function PlanSection({ prdDocumentId, existingPlan }: PlanSectionProps) {
    const [plan, setPlan] = useState<string | null>(existingPlan);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        setError(null);
        setGenerating(true);
        try {
            const res = await fetch(`/api/plan/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prdDocumentId }),
            });
            const data = await res.json();
            if (!data.success) {
                setError(data.error || 'Failed to generate PLAN.md');
                return;
            }
            setPlan(data.plan);
        } catch {
            setError('Error generating PLAN.md');
        } finally {
            setGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!plan) return;
        const blob = new Blob([plan], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'PLAN.md';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="card mt-lg" style={{ marginTop: 'var(--sp-xl)' }}>
            <div className="card-header">
                <h2>Implementation Plan (PLAN.md)</h2>
                {!plan && <span className="badge badge-default">Not Generated</span>}
                {plan && <span className="badge badge-success">Drafted</span>}
            </div>

            {error && <div className="alert alert-error mb-md">⚠️ {error}</div>}

            <div className="text-secondary mb-md">
                Generate an architectural blueprint and step-by-step phased development plan tailored exactly to this PRD. Great for your IDE.
            </div>

            {!plan ? (
                <div className="flex gap-md">
                    <button
                        className="btn btn-primary"
                        onClick={handleGenerate}
                        disabled={generating}
                    >
                        {generating ? <span className="spinner" /> : null}
                        Generate PLAN.md
                    </button>
                    <span className="text-secondary" style={{ alignSelf: 'center' }}>Optional</span>
                </div>
            ) : (
                <div className="mt-md">
                    <div className="flex gap-md mb-md">
                        <button
                            className="btn btn-secondary"
                            onClick={handleGenerate}
                            disabled={generating}
                        >
                            {generating ? <span className="spinner" /> : null}
                            Regenerate
                        </button>
                        <button className="btn btn-primary" onClick={handleDownload}>
                            ⬇️ Download PLAN.md
                        </button>
                    </div>

                    <div className="card" style={{ padding: 'var(--sp-md)', maxHeight: '400px', overflowY: 'auto' }}>
                        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '14px', margin: 0 }}>
                            {plan}
                        </pre>
                    </div>
                </div>
            )}
        </div>
    );
}
