'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/client';

export default function ProfilePage() {
    const router = useRouter();
    const { data: session } = authClient.useSession();
    const user = session?.user;

    const signOut = async () => {
        await authClient.signOut();
        router.push('/feed');
        router.refresh();
    };
    const [alerts, setAlerts] = useState([
        {
            id: '1',
            label: 'Minha Região',
            location: 'Vila Mariana, São Paulo',
            radius_km: 5,
            enabled: true,
            filters: { species: ['Cachorro', 'Gato'], type: ['lost'] },
        },
        {
            id: '2',
            label: 'Casa dos Pais',
            location: 'Moema, São Paulo',
            radius_km: 3,
            enabled: false,
            filters: { species: ['Cachorro'], type: ['lost', 'found'] },
        },
    ]);

    const toggleAlert = (id: string) => {
        setAlerts(alerts.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
    };

    return (
        <div className="page-content" style={{ maxWidth: '640px', margin: '0 auto', paddingTop: 'var(--space-2xl)' }}>
            {/* Profile Header */}
            <div className="glass-card" style={{ padding: 'var(--space-2xl) var(--space-xl)', textAlign: 'center', marginBottom: 'var(--space-2xl)', border: 'none', boxShadow: 'var(--shadow-md)' }}>
                <div style={{
                    width: '96px',
                    height: '96px',
                    borderRadius: '50%',
                    background: 'var(--bg-brand-soft)',
                    color: 'var(--color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto var(--space-md)',
                    fontSize: '2.5rem',
                    boxShadow: 'var(--shadow-sm)'
                }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                </div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 'var(--space-xs)' }}>
                    {user?.name || 'Sua conta'}
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginBottom: 'var(--space-xl)' }}>
                    {user?.email}
                </p>
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 'var(--space-2xl)',
                    paddingTop: 'var(--space-lg)',
                    borderTop: '1px solid var(--border-subtle)'
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>3</div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Posts</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>12</div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Avistamentos</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-found)' }}>1</div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Reencontrado</div>
                    </div>
                </div>
            </div>

            {/* Alerts */}
            <div style={{ marginBottom: 'var(--space-2xl)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Alertas por Região</h2>
                    <button className="btn btn-secondary btn-sm" style={{ padding: '0.5rem 1rem' }}>+ Novo Alerta</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                    {alerts.map((alert) => (
                        <div key={alert.id} className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-md) var(--space-lg)' }}>
                            <div>
                                <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '4px' }}>{alert.label}</h3>
                                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                    {alert.location} • {alert.radius_km}km
                                </p>
                                <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                                    {alert.filters.species?.map(s => (
                                        <span key={s} className="color-tag" style={{ background: 'var(--bg-secondary)' }}>{s}</span>
                                    ))}
                                    {alert.filters.type?.map(t => (
                                        <span key={t} className={`badge badge-${t === 'help_request' ? 'help' : t}`} style={{ fontSize: '0.6875rem' }}>
                                            {t === 'lost' ? 'Perdidos' : t === 'found' ? 'Encontrados' : 'Pedidos de Ajuda'}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <button
                                className={`toggle-switch ${alert.enabled ? 'active' : ''}`}
                                onClick={() => toggleAlert(alert.id)}
                                aria-label={`Ativar alerta ${alert.label}`}
                                style={{ transform: 'scale(0.9)', flexShrink: 0 }}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Quick Actions */}
            <div className="glass-card" style={{ padding: 'var(--space-xl)', border: 'none', background: 'var(--bg-card)' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 'var(--space-lg)' }}>Conta & Configurações</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                    <button className="btn btn-ghost" style={{ justifyContent: 'space-between', padding: '1rem', width: '100%', fontWeight: 500 }}>
                        <span>Meus Posts</span>
                        <span style={{ color: 'var(--text-muted)' }}>→</span>
                    </button>
                    <button className="btn btn-ghost" style={{ justifyContent: 'space-between', padding: '1rem', width: '100%', fontWeight: 500 }}>
                        <span>Meus Avistamentos</span>
                        <span style={{ color: 'var(--text-muted)' }}>→</span>
                    </button>
                    <button className="btn btn-ghost" style={{ justifyContent: 'space-between', padding: '1rem', width: '100%', fontWeight: 500 }}>
                        <span>Editar Perfil</span>
                        <span style={{ color: 'var(--text-muted)' }}>→</span>
                    </button>
                    <div style={{ height: '1px', background: 'var(--border-subtle)', margin: 'var(--space-md) 0' }} />
                    <button onClick={signOut} className="btn btn-ghost" style={{ justifyContent: 'flex-start', color: 'var(--color-lost)', padding: '1rem', width: '100%', fontWeight: 600 }}>
                        Sair da Conta
                    </button>
                </div>
            </div>
        </div>
    );
}
