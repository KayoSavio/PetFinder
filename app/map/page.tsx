'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Post, PostFilters } from '@/types';
import { getPostTypeLabel, getSpeciesEmoji, timeAgo, generateWhatsAppLink } from '@/lib/utils';
import dynamic from 'next/dynamic';

interface MapComponentProps {
    posts: Post[];
    userLocation: [number, number] | null;
    selectedPost: Post | null;
    onSelectPost: (post: Post | null) => void;
}

// Lazy load the map component (Leaflet needs window/document)
const MapComponent = dynamic<MapComponentProps>(
    () => import('@/components/map/MapComponent'),
    {
        ssr: false,
        loading: () => (
            <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-primary)',
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner spinner-lg" style={{ margin: '0 auto var(--space-md)' }} />
                    <p style={{ color: 'var(--text-secondary)' }}>Carregando mapa...</p>
                </div>
            </div>
        ),
    }
);

export default function MapPage() {
    const [posts, setPosts] = useState<Post[]>([]);
    useEffect(() => {
        fetch('/api/posts?limit=500')
            .then(res => (res.ok ? res.json() : Promise.reject()))
            .then(data => setPosts(data.features.map((f: { properties: Post }) => f.properties)))
            .catch(() => setPosts([]));
    }, []);
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [filters, setFilters] = useState<PostFilters>({});
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [isTracking, setIsTracking] = useState(false);
    const watchIdRef = useRef<number | null>(null);

    const filteredPosts = posts.filter(p => {
        if (filters.type && p.type !== filters.type) return false;
        if (filters.species && p.species.toLowerCase() !== filters.species.toLowerCase()) return false;
        if (filters.urgency && p.urgency !== filters.urgency) return false;
        return true;
    });

    // Start GPS tracking
    const startTracking = useCallback(() => {
        if (!navigator.geolocation) {
            setLocationError('Geolocalização não suportada');
            return;
        }

        setIsTracking(true);
        setLocationError(null);

        // Get initial position
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setUserLocation([pos.coords.latitude, pos.coords.longitude]);
            },
            (err) => {
                setLocationError(err.message);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );

        // Watch position in real-time
        watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
                setUserLocation([pos.coords.latitude, pos.coords.longitude]);
                setLocationError(null);
            },
            (err) => {
                console.warn('GPS error:', err.message);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 5000,
                timeout: 15000,
            }
        );
    }, []);

    // Stop GPS tracking
    const stopTracking = useCallback(() => {
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
        setIsTracking(false);
    }, []);

    // Auto-start GPS on mount
    useEffect(() => {
        startTracking();
        return () => stopTracking();
    }, [startTracking, stopTracking]);

    return (
        <div style={{ position: 'relative', height: 'calc(100vh - var(--nav-height))' }}>
            {/* Filter Bar Overlay */}
            <div className="map-overlay">
                <FilterPills filters={filters} setFilters={setFilters} />
            </div>

            {/* GPS Status Indicator */}
            <div style={{
                position: 'absolute',
                top: 'var(--space-md)',
                right: 'var(--space-md)',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-sm)',
                alignItems: 'flex-end',
            }}>
                <button
                    onClick={isTracking ? stopTracking : startTracking}
                    style={{
                        padding: '0.5rem 0.875rem',
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--bg-glass-strong)',
                        border: '1px solid var(--border-medium)',
                        color: 'var(--text-primary)',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        backdropFilter: 'blur(12px)',
                        boxShadow: 'var(--shadow-sm)',
                        cursor: 'pointer',
                        transition: 'var(--transition-fast)'
                    }}
                >
                    <span style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: isTracking ? 'var(--color-found)' : 'var(--color-lost)',
                        animation: isTracking ? 'pulse-urgent 2s infinite' : 'none',
                    }} />
                    {isTracking ? 'GPS Ativo' : 'Ligar GPS'}
                </button>
                {locationError && (
                    <div style={{
                        padding: '0.5rem 0.75rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-glass)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid var(--color-lost)',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        color: 'var(--color-lost)',
                        maxWidth: '220px',
                        boxShadow: 'var(--shadow-sm)'
                    }}>
                        ⚠️ {locationError}
                    </div>
                )}
            </div>

            {/* Map */}
            <MapComponent
                posts={filteredPosts}
                userLocation={userLocation}
                selectedPost={selectedPost}
                onSelectPost={setSelectedPost}
            />

            {/* Selected Post Popup (bottom card) */}
            {selectedPost && (
                <div style={{
                    position: 'absolute',
                    bottom: 'var(--space-lg)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 1000,
                    width: '90%',
                    maxWidth: '400px',
                    animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                }}>
                    <PostPopupCard post={selectedPost} onClose={() => setSelectedPost(null)} />
                </div>
            )}

            {/* Post count badge */}
            <div style={{
                position: 'absolute',
                bottom: 'var(--space-md)',
                left: 'var(--space-md)',
                zIndex: 1000,
                padding: '0.5rem 1rem',
                borderRadius: 'var(--radius-full)',
                background: 'var(--bg-glass-strong)',
                backdropFilter: 'blur(12px)',
                border: '1px solid var(--border-medium)',
                boxShadow: 'var(--shadow-sm)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem'
            }}>
                <span style={{ fontSize: '1.2em' }}>🐾</span> {filteredPosts.length} pets na região
            </div>
        </div>
    );
}

/* --- Sub-components --- */

function FilterPills({ filters, setFilters }: { filters: PostFilters; setFilters: (f: PostFilters) => void }) {
    return (
        <div className="filter-bar" style={{ padding: 0 }}>
            <button
                className={`filter-pill ${!filters.type ? 'active' : ''}`}
                onClick={() => setFilters({ ...filters, type: undefined })}
            >
                Todos
            </button>
            <button
                className={`filter-pill ${filters.type === 'lost' ? 'active' : ''}`}
                onClick={() => setFilters({ ...filters, type: filters.type === 'lost' ? undefined : 'lost' })}
                style={filters.type === 'lost' ? { borderColor: 'var(--color-lost)', color: 'var(--color-lost)' } : {}}
            >
                🔴 Perdidos
            </button>
            <button
                className={`filter-pill ${filters.type === 'found' ? 'active' : ''}`}
                onClick={() => setFilters({ ...filters, type: filters.type === 'found' ? undefined : 'found' })}
                style={filters.type === 'found' ? { borderColor: 'var(--color-found)', color: 'var(--color-found)' } : {}}
            >
                🟢 Encontrados
            </button>
            <button
                className={`filter-pill ${filters.type === 'help_request' ? 'active' : ''}`}
                onClick={() => setFilters({ ...filters, type: filters.type === 'help_request' ? undefined : 'help_request' })}
                style={filters.type === 'help_request' ? { borderColor: 'var(--color-help)', color: 'var(--color-help)' } : {}}
            >
                🟡 Precisa Ajuda
            </button>
        </div>
    );
}

function PostPopupCard({ post, onClose }: { post: Post; onClose: () => void }) {
    const whatsappLink = generateWhatsAppLink(
        post.contact_whatsapp,
        `Olá! Vi seu post no spykke sobre "${post.title}".`
    );

    return (
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden', cursor: 'default' }}>
            {/* Header color bar */}
            <div style={{
                height: '4px',
                background: post.type === 'lost' ? 'var(--color-lost)' : post.type === 'found' ? 'var(--color-found)' : 'var(--color-help)',
            }} />
            <div style={{ padding: 'var(--space-md)', display: 'flex', gap: 'var(--space-md)' }}>
                {/* Species emoji */}
                <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--gradient-brand-soft)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2rem',
                    flexShrink: 0,
                }}>
                    {getSpeciesEmoji(post.species)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: '4px' }}>
                        <span className={`badge badge-${post.type === 'help_request' ? 'help' : post.type}`} style={{ fontSize: '0.6875rem' }}>
                            {getPostTypeLabel(post.type)}
                        </span>
                        {post.urgency === 'urgent' && <span className="badge badge-urgent" style={{ fontSize: '0.6875rem' }}>URGENTE</span>}
                    </div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '2px' }}>{post.title}</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {post.species} • {post.neighborhood} • {timeAgo(post.event_datetime)}
                        {post.sighting_count ? ` • 👁️ ${post.sighting_count}` : ''}
                    </p>
                </div>
                <button
                    onClick={onClose}
                    style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: 'var(--bg-glass-strong)',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.875rem',
                        flexShrink: 0,
                    }}
                >
                    ✕
                </button>
            </div>
            <div style={{
                display: 'flex',
                gap: 'var(--space-sm)',
                padding: '0 var(--space-md) var(--space-md)',
            }}>
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="whatsapp-btn" style={{ flex: 1, justifyContent: 'center', fontSize: '0.8125rem' }}>
                    💬 WhatsApp
                </a>
                <a href={`/posts/${post.id}`} className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                    Ver detalhes →
                </a>
            </div>
        </div>
    );
}
