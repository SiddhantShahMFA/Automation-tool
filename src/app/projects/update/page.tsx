'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function UpdatePrdPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<{ prdDocumentId: string; notionPageUrl: string } | null>(null);

    const [notionUrl, setNotionUrl] = useState('');
    const [instructions, setInstructions] = useState('');
    const [statusText, setStatusText] = useState<string | null>(null);

    const handleSubmit = async () => {
        setError(null);
        setSuccess(null);
        setLoading(true);
        setStatusText('Analyzing instructions and updating PRD...');

        try {
            const res = await fetch('/api/prds/update/notion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notionUrl, instructions }),
            });
            const data = await res.json();

            if (data.error) {
                setError(data.error);
                return;
            }



            setSuccess({
                prdDocumentId: data.prdDocumentId,
                notionPageUrl: data.notionPageUrl,
            });
            // Clear inputs
            setNotionUrl('');
            setInstructions('');
        } catch (err: any) {
            setError(err.message || 'Failed to update PRD');
        } finally {
            setLoading(false);
            setStatusText(null);
        }
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <h1>Update PRD from Notion Link</h1>
                <p>Provide the Notion page link of an existing generated PRD and what you'd like to change.</p>
            </div>

            {error && <div className="alert alert-error mb-md">⚠️ {error}</div>}
            {success && (
                <div className="alert alert-success mb-md">
                    ✅ PRD successfully updated on Notion!{' '}
                    <a href={success.notionPageUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
                        View Update →
                    </a>
                </div>
            )}

            <div className="card">
                <div className="form-group">
                    <label className="form-label">Notion Page Link</label>
                    <input
                        type="url"
                        className="form-input"
                        placeholder="https://notion.so/workspace/Page-Title-1234..."
                        value={notionUrl}
                        onChange={(e) => setNotionUrl(e.target.value)}
                        disabled={loading}
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">Update Instructions / New Material</label>
                    <textarea
                        className="form-textarea form-textarea-large"
                        placeholder="e.g. We decided to add a new 'Enterprise User' persona. Also, change the primary goal from 'Growth' to 'Monetization'."
                        value={instructions}
                        onChange={(e) => setInstructions(e.target.value)}
                        disabled={loading}
                    />
                    <span className="form-hint">
                        Provide detailed instructions on what needs to be changed in the PRD.
                    </span>
                </div>

                <div className="flex gap-md mt-lg align-center">
                    <button className="btn btn-secondary" onClick={() => router.push('/projects')} disabled={loading}>
                        Cancel
                    </button>
                    <button
                        className="btn btn-primary btn-lg flex align-center"
                        onClick={handleSubmit}
                        disabled={loading || !notionUrl.trim() || !instructions.trim()}
                    >
                        {loading ? <span className="spinner mr-sm" /> : null}
                        {loading ? 'Processing...' : 'Update & Sync to Notion →'}
                    </button>
                    {statusText && <span className="text-secondary ml-md">{statusText}</span>}
                </div>
            </div>
            {success && (
                <div className="mt-md" style={{ textAlign: 'right' }}>
                    <button className="btn btn-secondary" onClick={() => router.push(`/projects/${success.prdDocumentId}`)}>
                        View Local PRD
                    </button>
                </div>
            )}
        </div>
    );
}
