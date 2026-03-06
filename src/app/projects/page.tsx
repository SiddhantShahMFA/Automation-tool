import { prisma } from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
    let projects: Array<{
        id: string;
        name: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        prdDocuments: Array<{
            id: string;
            status: string;
            notionPageUrl: string | null;
            version: number;
        }>;
    }> = [];

    try {
        projects = await prisma.project.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                prdDocuments: {
                    select: {
                        id: true,
                        status: true,
                        notionPageUrl: true,
                        version: true,
                    },
                },
            },
        });
    } catch {
        // DB might not be ready
    }

    return (
        <div className="page-container-wide">
            <div className="page-header page-header-actions">
                <div>
                    <h1>Projects</h1>
                    <p>Your PRD documents</p>
                </div>
                <Link href="/projects/new" className="btn btn-primary btn-lg">
                    + Create PRD
                </Link>
            </div>

            {projects.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📋</div>
                    <h3>No projects yet</h3>
                    <p>Create your first PRD to get started</p>
                    <Link href="/projects/new" className="btn btn-primary btn-lg">
                        + Create PRD
                    </Link>
                </div>
            ) : (
                <div className="project-grid">
                    {projects.map((project) => {
                        const latestPrd = project.prdDocuments[0];
                        const statusBadge =
                            latestPrd?.status === 'published'
                                ? 'badge-success'
                                : latestPrd?.status === 'draft'
                                    ? 'badge-warning'
                                    : 'badge-default';

                        return (
                            <Link
                                key={project.id}
                                href={`/projects/${project.id}`}
                                className="card project-card"
                                style={{ textDecoration: 'none', color: 'inherit' }}
                            >
                                <div className="card-header">
                                    <h3>{project.name}</h3>
                                    <span className={`badge ${statusBadge}`}>
                                        {latestPrd?.status || 'new'}
                                    </span>
                                </div>
                                <div className="project-card-meta">
                                    {latestPrd && (
                                        <span>v{latestPrd.version}</span>
                                    )}
                                    <span>
                                        Created{' '}
                                        {new Date(project.createdAt).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                        })}
                                    </span>
                                </div>
                                {latestPrd?.notionPageUrl && (
                                    <div className="mt-md">
                                        <span className="badge badge-accent">📄 Published to Notion</span>
                                    </div>
                                )}
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
