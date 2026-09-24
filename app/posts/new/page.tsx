'use client';

import { useReducer, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PhotoUploader from '@/components/posts/PhotoUploader';
import { isBusy, photoUrls, photosReducer } from '@/lib/photos/state';
import type { PostType, PostUrgency } from '@/types';

const STEPS = ['Tipo', 'Detalhes', 'Localização', 'Fotos', 'Contato', 'Revisar'];

export default function NewPostPage() {
    const router = useRouter();
    const [step, setStep] = useState(0);
    const [photos, dispatchPhotos] = useReducer(photosReducer, { items: [] });
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        type: '' as PostType | '',
        urgency: 'normal' as PostUrgency,
        title: '',
        description: '',
        species: '',
        size: '',
        color_tags: [] as string[],
        event_datetime: '',
        pin_lat: -23.5505,
        pin_lng: -46.6333,
        search_radius_km: 5,
        contact_whatsapp: '',
        contact_phone: '',
    });
    const [colorInput, setColorInput] = useState('');

    const nextStep = () => setStep(Math.min(step + 1, STEPS.length - 1));
    const prevStep = () => setStep(Math.max(step - 1, 0));

    const canProceed = () => {
        switch (step) {
            case 0: return !!formData.type;
            case 1: return !!formData.title && !!formData.species;
            case 2: return true;
            case 3: return !isBusy(photos); // espera as fotos terminarem de subir
            case 4: return !!formData.contact_whatsapp || !!formData.contact_phone;
            default: return true;
        }
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        setSubmitError(null);
        try {
            const res = await fetch('/api/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    photos: photoUrls(photos),
                    // datetime-local não tem fuso: converte no navegador para ISO (UTC)
                    event_datetime: formData.event_datetime ? new Date(formData.event_datetime).toISOString() : undefined,
                    base_lat: formData.type === 'help_request' ? formData.pin_lat : undefined,
                    base_lng: formData.type === 'help_request' ? formData.pin_lng : undefined,
                }),
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body.error || 'Erro ao criar post');
            router.push(`/posts/${body.id}`);
        } catch (e) {
            setSubmitError(e instanceof Error ? e.message : 'Erro ao criar post');
            setSubmitting(false);
        }
    };

    const addColorTag = () => {
        if (colorInput.trim() && !formData.color_tags.includes(colorInput.trim())) {
            setFormData({ ...formData, color_tags: [...formData.color_tags, colorInput.trim()] });
            setColorInput('');
        }
    };
    const removeColorTag = (tag: string) => {
        setFormData({ ...formData, color_tags: formData.color_tags.filter(t => t !== tag) });
    };

    return (
        <div className="page-content" style={{ maxWidth: '640px', margin: '0 auto', padding: 'var(--space-xl) var(--space-lg)' }}>
            <h1 className="page-title">
                ➕ Novo Post
            </h1>

            {/* Step Indicators */}
            <div className="step-indicators">
                {STEPS.map((s, i) => (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                        <div
                            className={`step-dot ${i === step ? 'active' : ''} ${i < step ? 'completed' : ''}`}
                            onClick={() => i < step && setStep(i)}
                            style={{ cursor: i < step ? 'pointer' : 'default' }}
                        />
                        {i < STEPS.length - 1 && <div className="step-connector" />}
                    </div>
                ))}
            </div>

            <p style={{
                textAlign: 'center',
                color: 'var(--text-secondary)',
                marginBottom: 'var(--space-xl)',
                fontSize: '0.875rem',
            }}>
                Passo {step + 1} de {STEPS.length}: <strong style={{ color: 'var(--text-primary)' }}>{STEPS[step]}</strong>
            </p>

            <div className="glass-card" style={{ padding: 'var(--space-xl)' }}>
                {/* Step 0: Type */}
                {step === 0 && (
                    <div className="form-step">
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Qual o tipo do post?</h2>
                        <div className="type-selector">
                            <button
                                className={`type-card ${formData.type === 'lost' ? 'selected' : ''}`}
                                onClick={() => setFormData({ ...formData, type: 'lost' })}
                                style={formData.type === 'lost' ? { borderColor: 'var(--color-lost)' } : {}}
                            >
                                <div className="type-card-icon">😢</div>
                                <div className="type-card-label">Perdido</div>
                                <div className="type-card-description">Meu pet sumiu</div>
                            </button>
                            <button
                                className={`type-card ${formData.type === 'found' ? 'selected' : ''}`}
                                onClick={() => setFormData({ ...formData, type: 'found' })}
                                style={formData.type === 'found' ? { borderColor: 'var(--color-found)' } : {}}
                            >
                                <div className="type-card-icon">🎉</div>
                                <div className="type-card-label">Encontrado</div>
                                <div className="type-card-description">Encontrei um pet</div>
                            </button>
                            <button
                                className={`type-card ${formData.type === 'help_request' ? 'selected' : ''}`}
                                onClick={() => setFormData({ ...formData, type: 'help_request' })}
                                style={formData.type === 'help_request' ? { borderColor: 'var(--color-help)' } : {}}
                            >
                                <div className="type-card-icon">🆘</div>
                                <div className="type-card-label">Pedido de Ajuda</div>
                                <div className="type-card-description">Preciso de voluntários</div>
                            </button>
                        </div>

                        {formData.type && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
                                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Urgência:</span>
                                <button
                                    className={`filter-pill ${formData.urgency === 'normal' ? 'active' : ''}`}
                                    onClick={() => setFormData({ ...formData, urgency: 'normal' })}
                                >
                                    Normal
                                </button>
                                <button
                                    className={`filter-pill ${formData.urgency === 'urgent' ? 'active' : ''}`}
                                    onClick={() => setFormData({ ...formData, urgency: 'urgent' })}
                                    style={formData.urgency === 'urgent' ? { borderColor: 'var(--color-lost)', color: 'var(--color-lost)' } : {}}
                                >
                                    🚨 Urgente
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Step 1: Details */}
                {step === 1 && (
                    <div className="form-step">
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Detalhes do Pet</h2>
                        <div className="input-group">
                            <label className="input-label">Nome / Título *</label>
                            <input
                                className="input"
                                placeholder="Ex: Luna - Golden Retriever"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Descrição</label>
                            <textarea
                                className="input"
                                placeholder="Descreva o pet, circunstâncias, detalhes úteis..."
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={4}
                            />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                            <div className="input-group">
                                <label className="input-label">Espécie *</label>
                                <select
                                    className="input"
                                    value={formData.species}
                                    onChange={(e) => setFormData({ ...formData, species: e.target.value })}
                                >
                                    <option value="">Selecione</option>
                                    <option value="Cachorro">🐕 Cachorro</option>
                                    <option value="Gato">🐈 Gato</option>
                                    <option value="Pássaro">🐦 Pássaro</option>
                                    <option value="Coelho">🐰 Coelho</option>
                                    <option value="Hamster">🐹 Hamster</option>
                                    <option value="Outro">🐾 Outro</option>
                                </select>
                            </div>
                            <div className="input-group">
                                <label className="input-label">Tamanho</label>
                                <select
                                    className="input"
                                    value={formData.size}
                                    onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                                >
                                    <option value="">Selecione</option>
                                    <option value="Pequeno">Pequeno</option>
                                    <option value="Médio">Médio</option>
                                    <option value="Grande">Grande</option>
                                </select>
                            </div>
                        </div>
                        <div className="input-group">
                            <label className="input-label">Cores</label>
                            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                <input
                                    className="input"
                                    placeholder="Ex: marrom"
                                    value={colorInput}
                                    onChange={(e) => setColorInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addColorTag())}
                                    style={{ flex: 1 }}
                                />
                                <button className="btn btn-secondary btn-sm" onClick={addColorTag} type="button">
                                    Adicionar
                                </button>
                            </div>
                            {formData.color_tags.length > 0 && (
                                <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap', marginTop: 'var(--space-sm)' }}>
                                    {formData.color_tags.map(tag => (
                                        <span key={tag} className="color-tag" style={{ cursor: 'pointer' }} onClick={() => removeColorTag(tag)}>
                                            {tag} ✕
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="input-group">
                            <label className="input-label">Data/Hora do Evento</label>
                            <input
                                type="datetime-local"
                                className="input"
                                value={formData.event_datetime}
                                onChange={(e) => setFormData({ ...formData, event_datetime: e.target.value })}
                            />
                        </div>
                    </div>
                )}

                {/* Step 2: Location */}
                {step === 2 && (
                    <div className="form-step">
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Localização</h2>
                        <p style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>
                            Defina onde o pet foi visto pela última vez para facilitar as buscas na região.
                        </p>
                        <div style={{
                            width: '100%',
                            height: '320px',
                            borderRadius: 'var(--radius-xl)',
                            background: 'var(--bg-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            overflow: 'hidden',
                            border: '1px solid var(--border-medium)',
                            boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.02)'
                        }}>
                            <div style={{
                                position: 'absolute',
                                inset: 0,
                                backgroundImage: `
                  radial-gradient(var(--border-strong) 1px, transparent 1px)
                `,
                                backgroundSize: '24px 24px',
                                opacity: 0.5
                            }} />
                            <div style={{
                                width: '64px',
                                height: '64px',
                                background: 'white',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '2rem',
                                color: 'var(--color-primary)',
                                position: 'relative',
                                zIndex: 1,
                                boxShadow: 'var(--shadow-lg)',
                                animation: 'bounce 2s infinite ease-in-out',
                            }}>
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                                </svg>
                            </div>
                            <div style={{
                                position: 'absolute',
                                bottom: 'var(--space-md)',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                fontSize: '0.8125rem',
                                padding: '0.5rem 1rem',
                                background: 'var(--bg-glass)',
                                backdropFilter: 'blur(8px)',
                                borderRadius: 'var(--radius-full)',
                                color: 'var(--text-secondary)',
                                fontWeight: 500,
                                zIndex: 1,
                                border: '1px solid var(--border-subtle)',
                                whiteSpace: 'nowrap'
                            }}>
                                📌 Integração com Mapbox será ativada aqui
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
                            <div className="input-group">
                                <label className="input-label">Latitude</label>
                                <input
                                    type="number"
                                    className="input"
                                    step="0.001"
                                    value={formData.pin_lat}
                                    onChange={(e) => setFormData({ ...formData, pin_lat: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Longitude</label>
                                <input
                                    type="number"
                                    className="input"
                                    step="0.001"
                                    value={formData.pin_lng}
                                    onChange={(e) => setFormData({ ...formData, pin_lng: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                        </div>
                        {formData.type === 'help_request' && (
                            <div className="input-group" style={{ marginTop: 'var(--space-md)' }}>
                                <label className="input-label">Raio de busca (km): {formData.search_radius_km}km</label>
                                <input
                                    type="range"
                                    min={1}
                                    max={20}
                                    value={formData.search_radius_km}
                                    onChange={(e) => setFormData({ ...formData, search_radius_km: parseInt(e.target.value) })}
                                    style={{ width: '100%', accentColor: 'var(--color-help)' }}
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Step 3: Photos */}
                {step === 3 && (
                    <div className="form-step">
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Fotos</h2>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            Adicione fotos do pet. Nós detectamos se é cachorro ou gato e usamos a foto para achar pets parecidos.
                        </p>
                        <PhotoUploader
                            state={photos}
                            dispatch={dispatchPhotos}
                            onSpeciesDetected={species => setFormData(f => (f.species ? f : { ...f, species }))}
                        />
                    </div>
                )}

                {/* Step 4: Contact */}
                {step === 4 && (
                    <div className="form-step">
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Contato</h2>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            Como as pessoas podem entrar em contato com você?
                        </p>
                        <div className="input-group">
                            <label className="input-label">WhatsApp *</label>
                            <input
                                className="input"
                                placeholder="5511999999999"
                                value={formData.contact_whatsapp}
                                onChange={(e) => setFormData({ ...formData, contact_whatsapp: e.target.value })}
                            />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Telefone</label>
                            <input
                                className="input"
                                placeholder="11999999999"
                                value={formData.contact_phone}
                                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                            />
                        </div>
                    </div>
                )}

                {/* Step 5: Review */}
                {step === 5 && (
                    <div className="form-step">
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Revisar Post</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                            <div className="info-item">
                                <div className="info-label">Tipo</div>
                                <div className="info-value">
                                    <span className={`badge badge-${formData.type === 'help_request' ? 'help' : formData.type}`}>
                                        {formData.type === 'lost' ? '😢 Perdido' : formData.type === 'found' ? '🎉 Encontrado' : '🆘 Pedido de Ajuda'}
                                    </span>
                                    {formData.urgency === 'urgent' && <span className="badge badge-urgent" style={{ marginLeft: 'var(--space-sm)' }}>URGENTE</span>}
                                </div>
                            </div>
                            <div className="info-item">
                                <div className="info-label">Título</div>
                                <div className="info-value">{formData.title || '—'}</div>
                            </div>
                            <div className="info-item">
                                <div className="info-label">Espécie / Tamanho</div>
                                <div className="info-value">{formData.species || '—'} • {formData.size || '—'}</div>
                            </div>
                            {formData.description && (
                                <div className="info-item">
                                    <div className="info-label">Descrição</div>
                                    <div className="info-value" style={{ fontSize: '0.875rem', fontWeight: 400 }}>{formData.description}</div>
                                </div>
                            )}
                            <div className="info-item">
                                <div className="info-label">Localização</div>
                                <div className="info-value">📍 {formData.pin_lat.toFixed(4)}, {formData.pin_lng.toFixed(4)}</div>
                            </div>
                            <div className="info-item">
                                <div className="info-label">Contato</div>
                                <div className="info-value">💬 {formData.contact_whatsapp || formData.contact_phone || '—'}</div>
                            </div>
                            {formData.color_tags.length > 0 && (
                                <div className="info-item">
                                    <div className="info-label">Cores</div>
                                    <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
                                        {formData.color_tags.map(tag => (
                                            <span key={tag} className="color-tag">{tag}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Navigation buttons */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 'var(--space-xl)',
                gap: 'var(--space-md)',
            }}>
                {step > 0 ? (
                    <button className="btn btn-secondary" onClick={prevStep}>
                        ← Voltar
                    </button>
                ) : (
                    <Link href="/feed" className="btn btn-ghost">
                        ← Cancelar
                    </Link>
                )}
                {step < STEPS.length - 1 ? (
                    <button
                        className="btn btn-primary"
                        onClick={nextStep}
                        disabled={!canProceed()}
                        style={{ opacity: canProceed() ? 1 : 0.5, padding: '0.75rem 2rem' }}
                    >
                        Próximo →
                    </button>
                ) : (
                    <div style={{ textAlign: 'right' }}>
                        <button className="btn btn-primary btn-lg" onClick={handleSubmit} disabled={submitting} style={{ fontWeight: 800, opacity: submitting ? 0.6 : 1 }}>
                            {submitting ? 'Publicando...' : 'Publicar Alerta'}
                        </button>
                        {submitError && <p style={{ color: 'var(--color-lost)', marginTop: 'var(--space-sm)' }}>{submitError}</p>}
                    </div>
                )}
            </div>
        </div>
    );
}
