'use client';

import { useRef, type Dispatch } from 'react';
import { uploadImage } from '@/lib/upload';
import {
    ACCEPTED_TYPES,
    MAX_PHOTOS,
    isAcceptedImage,
    labelFor,
    roomLeft,
    type PhotosAction,
    type PhotosState,
    type Species,
} from '@/lib/photos/state';

interface PhotoUploaderProps {
    state: PhotosState;
    dispatch: Dispatch<PhotosAction>;
    onSpeciesDetected: (species: 'Cachorro' | 'Gato') => void;
}

export default function PhotoUploader({ state, dispatch, onSpeciesDetected }: PhotoUploaderProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    function handleFiles(files: FileList | null) {
        if (!files) return;
        const selected = Array.from(files).filter(f => isAcceptedImage(f.type)).slice(0, Math.max(roomLeft(state), 0));
        // Cada arquivo entra no estado antes de subir: o limite e o "ocupado" já contam com ele
        for (const file of selected) {
            const id = crypto.randomUUID();
            dispatch({ type: 'add', id, preview: URL.createObjectURL(file) });
            upload(id, file);
        }
    }

    async function upload(id: string, file: File) {
        let url: string;
        try {
            url = await uploadImage(file);
        } catch {
            dispatch({ type: 'failed', id, message: 'Falha no envio' });
            return;
        }
        dispatch({ type: 'uploaded', id, url });
        try {
            const res = await fetch('/api/photos/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ photo_url: url }),
            });
            if (!res.ok) throw new Error();
            const data: { has_animal: boolean; species: Species | null } = await res.json();
            dispatch({ type: 'analyzed', id, hasAnimal: data.has_animal, species: data.species });
            if (data.species) onSpeciesDetected(data.species === 'dog' ? 'Cachorro' : 'Gato');
        } catch {
            dispatch({ type: 'unavailable', id });
        }
    }

    function remove(id: string, preview: string) {
        dispatch({ type: 'remove', id });
        URL.revokeObjectURL(preview);
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
                    accept={ACCEPTED_TYPES.join(',')}
                    multiple
                    hidden
                    onChange={e => { handleFiles(e.target.files); e.target.value = ''; }}
                />
            </div>

            {state.items.length > 0 && (
                <div className="image-preview-grid">
                    {state.items.map(item => (
                        <div key={item.id} className="image-preview" style={item.status === 'uploading' ? { opacity: 0.6 } : undefined}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={item.url ?? item.preview} alt="Foto do pet" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <span className="image-preview-label">{labelFor(item)}</span>
                            {item.status !== 'uploading' && (
                                <button className="remove-btn" onClick={() => remove(item.id, item.preview)}>✕</button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}
