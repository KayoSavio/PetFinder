'use client';

import { useRef, useState } from 'react';
import { uploadImage } from '@/lib/upload';

type Analysis =
    | { state: 'uploading' }
    | { state: 'analyzing' }
    | { state: 'done'; species: 'dog' | 'cat' | null }
    | { state: 'unavailable' }
    | { state: 'error'; message: string };

interface PhotoUploaderProps {
    photos: string[];
    onChange: (urls: string[]) => void;
    onSpeciesDetected: (species: 'Cachorro' | 'Gato') => void;
}

const MAX_PHOTOS = 5;
const SPECIES_LABEL = { dog: '🐶 Cachorro detectado', cat: '🐱 Gato detectado' } as const;

export default function PhotoUploader({ photos, onChange, onSpeciesDetected }: PhotoUploaderProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [pending, setPending] = useState<{ id: string; preview: string; analysis: Analysis }[]>([]);
    const [analysisByUrl, setAnalysisByUrl] = useState<Record<string, Analysis>>({});

    async function handleFiles(files: FileList | null) {
        if (!files) return;
        const room = MAX_PHOTOS - photos.length - pending.length;
        const selected = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, Math.max(room, 0));
        let urls = [...photos];

        for (const file of selected) {
            const id = crypto.randomUUID();
            const preview = URL.createObjectURL(file);
            setPending(p => [...p, { id, preview, analysis: { state: 'uploading' } }]);
            try {
                const url = await uploadImage(file);
                urls = [...urls, url];
                onChange(urls);
                setAnalysisByUrl(a => ({ ...a, [url]: { state: 'analyzing' } }));
                analyze(url);
            } catch {
                setAnalysisByUrl(a => ({ ...a, [preview]: { state: 'error', message: 'Falha no envio' } }));
            } finally {
                setPending(p => p.filter(x => x.id !== id));
                URL.revokeObjectURL(preview);
            }
        }
    }

    async function analyze(url: string) {
        try {
            const res = await fetch('/api/photos/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ photo_url: url }),
            });
            if (!res.ok) throw new Error();
            const data: { has_animal: boolean; species: 'dog' | 'cat' | null } = await res.json();
            setAnalysisByUrl(a => ({ ...a, [url]: { state: 'done', species: data.has_animal ? data.species : null } }));
            if (data.species) onSpeciesDetected(data.species === 'dog' ? 'Cachorro' : 'Gato');
        } catch {
            setAnalysisByUrl(a => ({ ...a, [url]: { state: 'unavailable' } }));
        }
    }

    function label(a: Analysis | undefined): string {
        if (!a || a.state === 'analyzing') return '🔎 Analisando...';
        if (a.state === 'uploading') return '⬆️ Enviando...';
        if (a.state === 'unavailable') return 'Análise indisponível agora';
        if (a.state === 'error') return a.message;
        return a.species ? SPECIES_LABEL[a.species] : '⚠️ Não encontramos um cachorro ou gato nesta foto';
    }

    return (
        <>
            <div
                className="image-upload-area"
                role="button"
                tabIndex={0}
                onClick={() => inputRef.current?.click()}
                onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            >
                <div style={{ fontSize: '3rem', marginBottom: 'var(--space-sm)' }}>📷</div>
                <p style={{ fontWeight: 600, marginBottom: 'var(--space-xs)' }}>Clique ou arraste fotos aqui</p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    PNG, JPG ou WEBP • até {MAX_PHOTOS} fotos • comprimidas automaticamente
                </p>
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    hidden
                    onChange={e => { handleFiles(e.target.files); e.target.value = ''; }}
                />
            </div>

            {(photos.length > 0 || pending.length > 0) && (
                <div className="image-preview-grid">
                    {photos.map(url => (
                        <div key={url} className="image-preview">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="Foto do pet" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <span className="image-preview-label">{label(analysisByUrl[url])}</span>
                            <button className="remove-btn" onClick={() => onChange(photos.filter(p => p !== url))}>✕</button>
                        </div>
                    ))}
                    {pending.map(p => (
                        <div key={p.id} className="image-preview" style={{ opacity: 0.6 }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.preview} alt="Enviando" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <span className="image-preview-label">{label(p.analysis)}</span>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}
