'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Post, PostFilters } from '@/types';
import { getPostTypeLabel, getPostTypeColor, getSpeciesEmoji, timeAgo, formatDistance } from '@/lib/utils';

export default function FeedPage() {
    const [posts, setPosts] = useState<Post[]>([]);
    const [filters, setFilters] = useState<PostFilters>({});
    const [loading, setLoading] = useState(true);
    const [userLat, setUserLat] = useState(-23.5505);
    const [userLng, setUserLng] = useState(-46.6333);

    useEffect(() => {
        // Try to get user location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setUserLat(pos.coords.latitude);
                    setUserLng(pos.coords.longitude);
                },
                () => { } // Fallback to default
            );
        }

        fetch(`/api/posts?near=${userLat},${userLng}&radius=50&limit=100`)
            .then(res => (res.ok ? res.json() : Promise.reject()))
            .then(data => setPosts(data.features.map((f: { properties: Post }) => f.properties)))
            .catch(() => setPosts([]))
            .finally(() => setLoading(false));
    }, [userLat, userLng]);

    const filteredPosts = posts.filter(p => {
        if (filters.type && p.type !== filters.type) return false;
        if (filters.species && p.species.toLowerCase() !== filters.species.toLowerCase()) return false;
        if (filters.urgency && p.urgency !== filters.urgency) return false;
        return true;
    });

    return (
        <div className="page-content">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
                <h1 className="page-title" style={{ marginBottom: 0 }}>
                    🐾 Feed por Proximidade
                </h1>
                <Link href="/posts/new" className="btn btn-primary btn-sm">
                    ➕ Novo Post
                </Link>
            </div>

            {/* Filter Bar */}
            <div className="filter-bar">
                <button
                    className={`filter-pill ${!filters.type ? 'active' : ''}`}
                    onClick={() => setFilters({ ...filters, type: undefined })}
                >
                    Todos
                </button>
                <button
                    className={`filter-pill ${filters.type === 'lost' ? 'active' : ''}`}
                    onClick={() => setFilters({ ...filters, type: filters.type === 'lost' ? undefined : 'lost' })}
                >
                    🔴 Perdidos
                </button>
                <button
                    className={`filter-pill ${filters.type === 'found' ? 'active' : ''}`}
                    onClick={() => setFilters({ ...filters, type: filters.type === 'found' ? undefined : 'found' })}
                >
                    🟢 Encontrados
                </button>
                <button
                    className={`filter-pill ${filters.type === 'help_request' ? 'active' : ''}`}
                    onClick={() => setFilters({ ...filters, type: filters.type === 'help_request' ? undefined : 'help_request' })}
                >
                    🟡 Pedidos de Ajuda
                </button>
                <select
                    className="filter-pill"
                    value={filters.species || ''}
                    onChange={(e) => setFilters({ ...filters, species: e.target.value || undefined })}
                    style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
                >
                    <option value="">Todas Espécies</option>
                    <option value="cachorro">🐕 Cachorro</option>
                    <option value="gato">🐈 Gato</option>
                    <option value="pássaro">🐦 Pássaro</option>
                    <option value="outro">🐾 Outro</option>
                </select>
            </div>

            {/* Post List */}
            {loading ? (
                <div className="loading-screen">
                    <div className="spinner spinner-lg" />
                    <p style={{ color: 'var(--text-secondary)' }}>Buscando pets próximos...</p>
                </div>
            ) : filteredPosts.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">🔍</div>
                    <h3 className="empty-state-title">Nenhum post encontrado</h3>
                    <p className="empty-state-desc">
                        Tente ajustar os filtros ou publique um novo post.
                    </p>
                    <Link href="/posts/new" className="btn btn-primary">
                        ➕ Publicar Pet
                    </Link>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    {filteredPosts.map((post) => (
                        <PostCard key={post.id} post={post} />
                    ))}
                </div>
            )}
        </div>
    );
}

function PostCard({ post }: { post: Post }) {
    return (
        <Link href={`/posts/${post.id}`} style={{ textDecoration: 'none' }}>
            <div className="glass-card post-card">
                <div className="post-card-image">
                    <div className="placeholder-img">
                        {getSpeciesEmoji(post.species)}
                    </div>
                </div>
                <div className="post-card-body">
                    <div className="post-card-header">
                        <span className={`badge badge-${post.type === 'help_request' ? 'help' : post.type}`}>
                            {getPostTypeLabel(post.type)}
                        </span>
                        {post.urgency === 'urgent' && <span className="badge badge-urgent">URGENTE</span>}
                        {post.status === 'resolved' && <span className="badge badge-resolved">REENCONTRADO ❤️</span>}
                    </div>
                    <h3 className="post-card-title">{post.title}</h3>
                    <p className="post-card-description">{post.description}</p>
                    <div className="post-card-meta">
                        <span>{getSpeciesEmoji(post.species)} {post.species}</span>
                        <span>📐 {post.size}</span>
                        <span>📍 {post.neighborhood}</span>
                        {post.distance_km !== undefined && (
                            <span>🏃 {formatDistance(post.distance_km)}</span>
                        )}
                        <span>🕐 {timeAgo(post.event_datetime)}</span>
                    </div>
                    <div className="post-card-footer">
                        <div className="post-card-tags">
                            {post.color_tags.slice(0, 3).map((tag) => (
                                <span key={tag} className="color-tag">{tag}</span>
                            ))}
                        </div>
                        {post.sighting_count ? (
                            <span style={{ fontSize: '0.8125rem', color: 'var(--color-primary-light)' }}>
                                👁️ {post.sighting_count} avistamentos
                            </span>
                        ) : null}
                    </div>
                </div>
            </div>
        </Link>
    );
}
