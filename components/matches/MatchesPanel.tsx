'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { Post, MatchResult } from '@/types';
import { getSpeciesEmoji, timeAgo } from '@/lib/utils';

// Leaflet só funciona no browser
const MatchMap = dynamic(() => import('./MatchMap'), { ssr: false });

interface MatchesPanelProps {
    post: Post;
}

function similarityColor(s: number): string {
    if (s >= 0.8) return 'var(--color-found, #10b981)';
    if (s >= 0.7) return '#f59e0b';
    return 'var(--text-muted, #94a3b8)';
}

function similarityLabel(s: number): string {
    if (s >= 0.85) return 'Muito parecido';
    if (s >= 0.75) return 'Parecido';
    return 'Possível';
}

export default function MatchesPanel({ post }: MatchesPanelProps) {
    const [matches, setMatches] = useState<MatchResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedMatch, setSelectedMatch] = useState<MatchResult | null>(null);

    const fetchMatches = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/posts/${post.id}/matches?max_results=6`);
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || 'Erro ao buscar matches');
            }
            setMatches(await res.json());
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erro desconhecido');
        } finally {
            setLoading(false);
        }
    }, [post.id]);

    useEffect(() => {
        fetchMatches();
    }, [fetchMatches]);

    const originPhoto = post.photos?.[0];
    const searchLabel = post.type === 'found'
        ? 'Procurando donos que perderam um pet parecido...'
        : 'Procurando pets encontrados parecidos com o seu...';

    return (
        <div style={{ marginTop: 'var(--space-xl)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                    ✨ Possíveis Matches {matches.length > 0 && `(${matches.length})`}
                </h2>
                <button className="btn btn-ghost btn-sm" onClick={fetchMatches} disabled={loading}>
                    🔄 Atualizar
                </button>
            </div>

            {loading && (
                <div className="glass-card" style={{ padding: 'var(--space-xl)', textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>🔍</div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{searchLabel}</p>
                </div>
            )}

            {!loading && error && (
                <div className="glass-card" style={{ padding: 'var(--space-lg)', textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        ⚠️ {error}
                    </p>
                </div>
            )}

            {!loading && !error && matches.length === 0 && (
                <div className="empty-state" style={{ padding: 'var(--space-xl)' }}>
                    <div className="empty-state-icon">🕵️</div>
                    <h3 className="empty-state-title">Nenhum match ainda</h3>
                    <p className="empty-state-desc">
                        Quando alguém publicar um pet parecido na região, ele aparece aqui.
                    </p>
                </div>
            )}

            {!loading && !error && matches.length > 0 && (
                <>
                    {/* Lista de matches: foto do post × foto do match */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                        {matches.map((m) => {
                            const isSelected = selectedMatch?.photo_url === m.photo_url;
                            return (
                                <div
                                    key={`${m.post_id}-${m.photo_url}`}
                                    className="glass-card"
                                    onClick={() => setSelectedMatch(isSelected ? null : m)}
                                    style={{
                                        padding: 'var(--space-md)',
                                        cursor: 'pointer',
                                        border: isSelected
                                            ? `1.5px solid ${similarityColor(m.similarity)}`
                                            : '1px solid var(--border-subtle)',
                                        transition: 'border 0.2s ease',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                                        {/* Foto do seu pet */}
                                        <PhotoThumb src={originPhoto} fallback={getSpeciesEmoji(post.species)} label="Seu post" />

                                        {/* Score no meio */}
                                        <div style={{ textAlign: 'center', minWidth: '72px' }}>
                                            <div style={{
                                                fontSize: '1.25rem',
                                                fontWeight: 800,
                                                color: similarityColor(m.similarity),
                                            }}>
                                                {Math.round(m.similarity * 100)}%
                                            </div>
                                            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                                                {similarityLabel(m.similarity)}
                                            </div>
                                            {m.distance_km != null && (
                                                <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                                    📍 {m.distance_km < 1
                                                        ? `${Math.round(m.distance_km * 1000)}m`
                                                        : `${m.distance_km.toFixed(1)}km`}
                                                </div>
                                            )}
                                        </div>

                                        {/* Foto avistada */}
                                        <PhotoThumb src={m.photo_url} fallback="🐾" label="Avistado" />

                                        {/* Info do post que deu match */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {m.post?.title || 'Post'}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                {m.post?.neighborhood && `${m.post.neighborhood} • `}
                                                {m.post?.created_at && timeAgo(m.post.created_at)}
                                            </div>
                                            <Link
                                                href={`/posts/${m.post_id}`}
                                                className="btn btn-secondary btn-sm"
                                                style={{ marginTop: 'var(--space-xs)' }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                Ver post →
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Mapa com localização dos matches */}
                    <div className="glass-card" style={{ padding: 'var(--space-lg)' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 'var(--space-md)' }}>
                            🗺️ Onde foram vistos
                        </h3>
                        <div style={{
                            width: '100%',
                            height: '280px',
                            borderRadius: 'var(--radius-md)',
                            overflow: 'hidden',
                            border: '1px solid var(--border-subtle)',
                        }}>
                            <MatchMap
                                post={post}
                                matches={matches}
                                selectedMatch={selectedMatch}
                                onSelectMatch={setSelectedMatch}
                            />
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'var(--space-sm)' }}>
                            🏠 = local do seu post • pins com % = onde o pet parecido foi visto
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}

function PhotoThumb({ src, fallback, label }: { src?: string; fallback: string; label: string }) {
    return (
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{
                width: '64px',
                height: '64px',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                background: 'var(--gradient-brand-soft, rgba(124,58,237,0.15))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.75rem',
                border: '1px solid var(--border-subtle)',
            }}>
                {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                    fallback
                )}
            </div>
            <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: '2px' }}>{label}</div>
        </div>
    );
}
