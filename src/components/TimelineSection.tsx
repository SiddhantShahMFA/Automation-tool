import type { TimelineEntry } from '@/lib/prd/types';

interface TimelineSectionProps {
    entries: TimelineEntry[];
}

export default function TimelineSection({ entries }: TimelineSectionProps) {
    return (
        <div className="card mt-lg" style={{ marginTop: 'var(--sp-xl)' }}>
            <div className="card-header">
                <h2>Project Timeline</h2>
                <span className="badge badge-default">{entries.length} Events</span>
            </div>

            {entries.length === 0 ? (
                <p className="text-secondary">No timeline events recorded yet.</p>
            ) : (
                <div className="flex flex-col gap-sm">
                    {entries.map((entry) => (
                        <div key={entry.id} className="card" style={{ padding: 'var(--sp-md)' }}>
                            <div className="flex items-center justify-between gap-sm">
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1rem' }}>{entry.title}</h3>
                                    <p className="text-secondary text-sm" style={{ margin: 'var(--sp-xs) 0 0 0' }}>
                                        {entry.description}
                                    </p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <span className="badge badge-accent">{entry.type}</span>
                                    <p className="text-secondary text-sm" style={{ marginTop: 'var(--sp-xs)' }}>
                                        {new Date(entry.timestamp).toLocaleString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
