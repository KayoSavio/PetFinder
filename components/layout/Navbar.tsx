'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/client';

export function Navbar() {
    const pathname = usePathname();
    const router = useRouter();
    const { data: session, isPending } = authClient.useSession();
    const user = session?.user;

    const signOut = async () => {
        await authClient.signOut();
        router.push('/feed');
        router.refresh();
    };

    const links = [
        { href: '/map', label: 'Mapa', icon: '🗺️' },
        { href: '/feed', label: 'Feed', icon: '📋' },
        { href: '/posts/new', label: 'Novo Post', icon: '➕' },
        { href: '/profile', label: 'Perfil', icon: '👤' },
    ];

    return (
        <nav className="navbar" style={{
            background: 'var(--bg-glass)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid var(--border-subtle)',
        }}>
            <div className="navbar-inner">
                <Link href="/" className="navbar-logo" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        width: '32px', height: '32px',
                        background: 'var(--color-primary)',
                        color: 'white',
                        borderRadius: '8px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.2rem'
                    }}>
                        🐾
                    </div>
                    <span style={{ fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', fontSize: '1.25rem' }}>
                        Pet<span style={{ color: 'var(--color-primary)' }}>Finder</span>
                    </span>
                </Link>

                <div className="navbar-links">
                    {links.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`navbar-link ${pathname === link.href ? 'active' : ''}`}
                        >
                            <span style={{ marginRight: '0.375rem', fontSize: '1.1em' }} aria-hidden="true">{link.icon}</span>
                            <span style={{ fontWeight: 500 }}>{link.label}</span>
                        </Link>
                    ))}
                </div>

                <div className="navbar-actions" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                    {isPending ? null : user ? (
                        <>
                            <Link href="/profile" style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                                {user.name || user.email}
                            </Link>
                            <button onClick={signOut} className="btn btn-ghost btn-sm">Sair</button>
                        </>
                    ) : (
                        <Link href="/login" className="btn btn-primary btn-sm">
                            Entrar
                        </Link>
                    )}
                </div>
            </div>
        </nav>
    );
}
