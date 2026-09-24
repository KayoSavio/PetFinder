'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { Post, Sighting } from '@/types';
import { getPostTypeLabel, getSpeciesEmoji, timeAgo, formatDate, generateWhatsAppLink } from '@/lib/utils';
import MatchesPanel from '@/components/matches/MatchesPanel';

export default function PostDetailPage() {
    const params = useParams();
    const postId = params.id as string;
    const [post, setPost] = useState<Post | null>(null);
    const [sightings, setSightings] = useState<Sighting[]>([]);
    const [loading, setLoading] = useState(true);
    const [showSightingForm, setShowSightingForm] = useState(false);
    const [sightingNote, setSightingNote] = useState('');
    const [sightingError, setSightingError] = useState<string | null>(null);

    const loadSightings = useCallback(
        () => fetch(`/api/posts/${postId}/sightings`)
            .then(r => (r.ok ? r.json() : { sightings: [] }))
            .then(s => setSightings(s.sightings)),
        [postId],
    );

    useEffect(() => {
        Promise.all([
            fetch(`/api/posts/${postId}`).then(r => (r.ok ? r.json() : null)),
            loadSightings(),
        ])
            .then(([p]) => setPost(p))
            .finally(() => setLoading(false));
    }, [postId, loadSightings]);

    const submitSighting = async () => {
        if (!post) return;
        setSightingError(null);
        // Por enquanto usa o local do post; a posição real do avistamento vem com a área provável
        const res = await fetch(`/api/posts/${postId}/sightings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat: post.pin_lat, lng: post.pin_lng, note: sightingNote }),
        });
        if (!res.ok) {
            setSightingError((await res.json().catch(() => ({}))).error || 'Erro ao registrar avistamento');
            return;
        }
        setShowSightingForm(false);
        setSightingNote('');
        loadSightings();
    };

    if (loading) {
        return <div className="page-content"><div className="empty-state"><div className="empty-state-icon">⏳</div></div></div>;
    }

    if (!post) {
        return (
            <div className="page-content">
                <div className="empty-state">
                    <div className="empty-state-icon">🔍</div>
                    <h3 className="empty-state-title">Post não encontrado</h3>
                    <p className="empty-state-desc">Este post pode ter sido removido ou o link está incorreto.</p>
                    <Link href="/feed" className="btn btn-primary">← Voltar ao Feed</Link>
                </div>
            </div>
        );
    }

    const whatsappLink = generateWhatsAppLink(
        post.contact_whatsapp,
        `Olá! Vi seu post no spykke sobre "${post.title}". `
    );

    return (
        <div className="page-content post-detail">
            {/* Back */}
            <Link href="/feed" className="btn btn-ghost btn-sm" style={{ marginBottom: 'var(--space-md)' }}>
                ← Voltar
            </Link>

            {/* Gallery */}
            <div className="post-detail-gallery">
                {post.photos[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.photos[0]} alt={post.title} style={{ width: '100%', height: '300px', objectFit: 'cover', borderRadius: 'var(--radius-lg)' }} />
                ) : (
                <div style={{
                    width: '100%',
                    height: '300px',
                    borderRadius: 'var(--radius-lg)',
                    background: 'var(--gradient-brand-soft)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '5rem',
                    border: '1px solid var(--border-subtle)',
                }}>
                    {getSpeciesEmoji(post.species)}
                </div>
                )}
            </div>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)', flexWrap: 'wrap' }}>
                        <span className={`badge badge-${post.type === 'help_request' ? 'help' : post.type}`}>
                            {getPostTypeLabel(post.type)}
                        </span>
                        {post.urgency === 'urgent' && <span className="badge badge-urgent">URGENTE</span>}
                        {post.status === 'resolved' && <span className="badge badge-resolved">REENCONTRADO ❤️</span>}
                    </div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 'var(--space-xs)' }}>
                        {post.title}
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        Publicado {timeAgo(post.created_at)}{[post.neighborhood, post.city].filter(Boolean).length > 0 && ` • ${[post.neighborhood, post.city].filter(Boolean).join(', ')}`}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                    <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="whatsapp-btn">
                        💬 WhatsApp
                    </a>
                    {post.contact_phone && (
                        <a href={`tel:${post.contact_phone}`} className="btn btn-secondary btn-sm">
                            📞 Ligar
                        </a>
                    )}
                </div>
            </div>

            {/* Description */}
            <div className="glass-card" style={{ padding: 'var(--space-lg)', marginTop: 'var(--space-xl)' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 'var(--space-sm)' }}>Descrição</h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '0.9375rem' }}>
                    {post.description}
                </p>
            </div>

            {/* Info Grid */}
            <div className="post-detail-info">
                <div className="info-item">
                    <div className="info-label">Espécie</div>
                    <div className="info-value">{getSpeciesEmoji(post.species)} {post.species}</div>
                </div>
                <div className="info-item">
                    <div className="info-label">Tamanho</div>
                    <div className="info-value">{post.size}</div>
                </div>
                <div className="info-item">
                    <div className="info-label">Data do Evento</div>
                    <div className="info-value">{formatDate(post.event_datetime)}</div>
                </div>
                <div className="info-item">
                    <div className="info-label">Status</div>
                    <div className="info-value" style={{ color: post.status === 'resolved' ? 'var(--color-found)' : 'var(--text-primary)' }}>
                        {post.status === 'resolved' ? '✅ Reencontrado' : '🔎 Ativo'}
                    </div>
                </div>
            </div>

            {/* Color Tags */}
            {post.color_tags.length > 0 && (
                <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap', marginBottom: 'var(--space-xl)' }}>
                    {post.color_tags.map(tag => (
                        <span key={tag} className="color-tag">{tag}</span>
                    ))}
                </div>
            )}

            {/* Mini Map */}
            <div className="glass-card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-xl)' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 'var(--space-md)' }}>📍 Localização</h3>
                <div style={{
                    width: '100%',
                    height: '200px',
                    borderRadius: 'var(--radius-md)',
                    background: 'linear-gradient(135deg, #0a0a2e, #1a1a3e)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                    border: '1px solid var(--border-subtle)',
                }}>
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage: `
              linear-gradient(rgba(124, 58, 237, 0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(124, 58, 237, 0.05) 1px, transparent 1px)
            `,
                        backgroundSize: '40px 40px',
                    }} />
                    <span style={{ fontSize: '2rem', zIndex: 1 }}>📍</span>
                    <span style={{
                        position: 'absolute',
                        bottom: 'var(--space-sm)',
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        zIndex: 1,
                    }}>
                        {post.pin_lat.toFixed(4)}, {post.pin_lng.toFixed(4)}
                    </span>
                </div>
            </div>

            {/* AI Matches Section */}
            {post.status === 'active' && <MatchesPanel post={post} />}

            {/* Sightings Section */}
            <div style={{ marginTop: 'var(--space-xl)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                        👁️ Avistamentos ({sightings.length})
                    </h2>
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={() => setShowSightingForm(!showSightingForm)}
                    >
                        {showSightingForm ? '✕ Cancelar' : '👁️ Eu vi esse animal'}
                    </button>
                </div>

                {/* Sighting Form */}
                {showSightingForm && (
                    <div className="glass-card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-lg)', animation: 'slideUp 0.3s ease' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 'var(--space-md)' }}>Registrar Avistamento</h3>
                        <div className="form-step">
                            <div className="input-group">
                                <label className="input-label">O que você viu?</label>
                                <textarea
                                    className="input"
                                    placeholder="Descreva onde e quando você viu o animal..."
                                    value={sightingNote}
                                    onChange={(e) => setSightingNote(e.target.value)}
                                    rows={3}
                                />
                            </div>
                            <button
                                className="btn btn-primary"
                                onClick={submitSighting}
                                disabled={!sightingNote.trim()}
                                style={{ opacity: sightingNote.trim() ? 1 : 0.5 }}
                            >
                                📍 Registrar Avistamento
                            </button>
                            {sightingError && <p style={{ color: 'var(--color-lost)', fontSize: '0.875rem' }}>{sightingError}</p>}
                        </div>
                    </div>
                )}

                {/* Sighting Timeline */}
                {sightings.length === 0 ? (
                    <div className="empty-state" style={{ padding: 'var(--space-xl)' }}>
                        <div className="empty-state-icon">👁️</div>
                        <h3 className="empty-state-title">Nenhum avistamento ainda</h3>
                        <p className="empty-state-desc">Seja o primeiro a registrar um avistamento deste pet.</p>
                    </div>
                ) : (
                    <div className="sighting-timeline">
                        {sightings.map((sighting) => (
                            <div key={sighting.id} className="sighting-item">
                                <p className="sighting-note">{sighting.note}</p>
                                <div className="sighting-meta">
                                    📍 {sighting.lat.toFixed(4)}, {sighting.lng.toFixed(4)} • 🕐 {formatDate(sighting.datetime)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
