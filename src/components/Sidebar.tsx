'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
            </nav>

            <div style={{ padding: 'var(--sp-md)', borderTop: '1px solid var(--border)' }}>
                <div className="text-sm text-secondary">
                    Internal Tool · No Auth Required
                </div>
            </div>
        </aside>
    );
}
