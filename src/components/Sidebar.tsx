'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';

const navItems = [
    {
        label: 'Setup',
        href: '/setup',
        icon: '⚙️',
    },
    {
        label: 'Projects',
        href: '/projects',
        icon: '📋',
    },
];

export function Sidebar() {
    const pathname = usePathname();
    const { data: session } = useSession();

    return (
        <aside className="sidebar">
            <div className="sidebar-brand">
                <div className="sidebar-brand-icon">P</div>
                <div>
                    <h1>PRD Autopilot</h1>
                    <span>v1.0</span>
                </div>
            </div>

            <nav className="sidebar-nav">
                <div className="sidebar-nav-label">Navigation</div>
                {navItems.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`nav-link ${pathname.startsWith(item.href) ? 'active' : ''
                            }`}
                    >
                        <span className="nav-link-icon">{item.icon}</span>
                        {item.label}
                    </Link>
                ))}

                {session && (
                    <button
                        onClick={() => signOut({ callbackUrl: '/login' })}
                        className="nav-link w-full text-left flex items-center mt-4 text-gray-500 hover:text-red-600 transition-colors"
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}
                    >
                        <span className="nav-link-icon">🚪</span>
                        Logout
                    </button>
                )}
            </nav>

            <div style={{ padding: 'var(--sp-md)', borderTop: '1px solid var(--border)' }}>
                <div className="text-sm text-secondary">
                    {session?.user ? `Logged in as ${session.user.name || session.user.email}` : 'Not logged in'}
                </div>
            </div>
        </aside>
    );
}
