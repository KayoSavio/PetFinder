// Estado das fotos do formulário de post: envio ao Blob + análise de espécie.
// Vive no formulário (não no PhotoUploader), para sobreviver à troca de passo.

export const MAX_PHOTOS = 5;
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export type Species = 'dog' | 'cat';

export interface PhotoItem {
    id: string;
    preview: string;
    url?: string;
    status: 'uploading' | 'analyzing' | 'done' | 'unavailable' | 'error';
    hasAnimal?: boolean;
    species?: Species | null;
    error?: string;
}

export interface PhotosState {
    items: PhotoItem[];
}

export type PhotosAction =
    | { type: 'add'; id: string; preview: string }
    | { type: 'uploaded'; id: string; url: string }
    | { type: 'failed'; id: string; message: string }
    | { type: 'analyzed'; id: string; hasAnimal: boolean; species: Species | null }
    | { type: 'unavailable'; id: string }
    | { type: 'remove'; id: string };

function patch(state: PhotosState, id: string, changes: Partial<PhotoItem>): PhotosState {
    // Ações de uma foto já removida não fazem nada
    return { items: state.items.map(i => (i.id === id ? { ...i, ...changes } : i)) };
}

export function photosReducer(state: PhotosState, action: PhotosAction): PhotosState {
    switch (action.type) {
        case 'add':
            return { items: [...state.items, { id: action.id, preview: action.preview, status: 'uploading' }] };
        case 'uploaded':
            return patch(state, action.id, { url: action.url, status: 'analyzing' });
        case 'failed':
            return patch(state, action.id, { status: 'error', error: action.message });
        case 'analyzed':
            return patch(state, action.id, { status: 'done', hasAnimal: action.hasAnimal, species: action.species });
        case 'unavailable':
            return patch(state, action.id, { status: 'unavailable' });
        case 'remove':
            return { items: state.items.filter(i => i.id !== action.id) };
    }
}

/** URLs já enviadas (entram no post), na ordem em que foram adicionadas. */
export function photoUrls(state: PhotosState): string[] {
    return state.items.flatMap(i => (i.url && i.status !== 'error' ? [i.url] : []));
}

export function isBusy(state: PhotosState): boolean {
    return state.items.some(i => i.status === 'uploading');
}

export function roomLeft(state: PhotosState): number {
    return MAX_PHOTOS - state.items.filter(i => i.status !== 'error').length;
}

export function isAcceptedImage(type: string): boolean {
    return ACCEPTED_TYPES.includes(type);
}

const SPECIES_LABEL: Record<Species, string> = { dog: '🐶 Cachorro detectado', cat: '🐱 Gato detectado' };

export function labelFor(item: PhotoItem): string {
    switch (item.status) {
        case 'uploading': return '⬆️ Enviando...';
        case 'analyzing': return '🔎 Analisando...';
        case 'unavailable': return 'Análise indisponível agora';
        case 'error': return item.error ?? 'Falha no envio';
        case 'done':
            if (item.species) return SPECIES_LABEL[item.species];
            return item.hasAnimal ? '🐾 Animal detectado' : '⚠️ Não encontramos um cachorro ou gato nesta foto';
    }
}
