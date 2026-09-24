'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setTimeout(() => {
            alert('✅ Login simulado! O login real (Neon Auth) chega na próxima etapa.');
            setLoading(false);
        }, 1000);
    };

    return (
        <div className="page-content" style={{ maxWidth: '440px', margin: '0 auto', paddingTop: 'var(--space-3xl)' }}>
            <div className="glass-card" style={{ padding: 'var(--space-2xl) var(--space-xl)', border: 'none', boxShadow: 'var(--shadow-lg)' }}>
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
                    <div style={{
                        width: '64px', height: '64px',
                        background: 'var(--color-primary)', color: 'white',
                        borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '2rem', margin: '0 auto var(--space-md)', boxShadow: 'var(--shadow-sm)'
                    }}>
                        🐾
                    </div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 'var(--space-xs)' }}>
                        Bem-vindo de volta
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
                        Entre para publicar posts e receber alertas da comunidade
                    </p>
                </div>

                {/* Google OAuth */}
                <button className="btn btn-secondary" style={{ width: '100%', padding: '0.75rem', background: 'white', border: '1px solid var(--border-medium)', color: 'var(--text-primary)', fontWeight: 600 }}>
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.797 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4" />
                        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.909-2.259c-.806.54-1.837.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
                        <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
                        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
                    </svg>
                    Continuar com Google
                </button>

                <div style={{ display: 'flex', alignItems: 'center', margin: 'var(--space-lg) 0', color: 'var(--text-muted)' }}>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
                    <span style={{ margin: '0 var(--space-md)', fontSize: '0.8125rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>ou use email</span>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="input-group" style={{ marginBottom: 'var(--space-md)' }}>
                        <label className="input-label">Email</label>
                        <input
                            type="email"
                            className="input"
                            placeholder="seu@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="input-group" style={{ marginBottom: 'var(--space-xl)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <label className="input-label">Senha</label>
                            <a href="#" style={{ fontSize: '0.8125rem', color: 'var(--color-primary)', fontWeight: 500 }}>Esqueceu a senha?</a>
                        </div>
                        <input
                            type="password"
                            className="input"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', padding: '0.875rem', fontWeight: 700, fontSize: '1rem' }}
                        disabled={loading}
                    >
                        {loading ? <span className="spinner" /> : 'Entrar na Conta'}
                    </button>
                </form>

                <p style={{ textAlign: 'center', marginTop: 'var(--space-xl)', fontSize: '0.9375rem', color: 'var(--text-secondary)' }}>
                    Novo por aqui?{' '}
                    <Link href="/register" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Crie uma conta gratuita</Link>
                </p>
            </div>
        </div>
    );
}
