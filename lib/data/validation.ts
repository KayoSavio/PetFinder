import type { PostType, PostUrgency } from '@/types';

export interface NewPostInput {
    type: PostType;
    urgency: PostUrgency;
    title: string;
    description: string;
    species: string;
    size: string;
    color_tags: string[];
    event_datetime: string | null;
    pin_lat: number;
    pin_lng: number;
    base_lat: number | null;
    base_lng: number | null;
    search_radius_km: number | null;
    city: string;
    neighborhood: string;
    photos: string[];
    contact_whatsapp: string;
    contact_phone: string;
}

export interface NewSightingInput {
    lat: number;
    lng: number;
    datetime: string;
    note: string;
    photo_url: string | null;
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const POST_TYPES: PostType[] = ['lost', 'found', 'help_request'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(id: string): boolean {
    return UUID_RE.test(id);
}

function missing(v: unknown): boolean {
    return v === undefined || v === null || v === '';
}

function toNum(v: unknown): number | null {
    const n = typeof v === 'string' ? Number(v) : v;
    return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

function validLatLng(lat: number | null, lng: number | null): boolean {
    return lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function str(v: unknown): string {
    return typeof v === 'string' ? v.trim() : '';
}

export function validateNewPost(body: unknown): Result<NewPostInput> {
    const b = (body ?? {}) as Record<string, unknown>;
    for (const field of ['type', 'title', 'species', 'pin_lat', 'pin_lng']) {
        if (missing(b[field])) return { ok: false, error: `Campo obrigatório: ${field}` };
    }
    if (!POST_TYPES.includes(b.type as PostType)) return { ok: false, error: 'Tipo de post inválido' };

    const lat = toNum(b.pin_lat);
    const lng = toNum(b.pin_lng);
    if (!validLatLng(lat, lng)) return { ok: false, error: 'Localização inválida' };

    const photos = Array.isArray(b.photos) ? b.photos : [];
    if (!photos.every(p => typeof p === 'string' && p.startsWith('https://'))) {
        return { ok: false, error: 'Foto inválida' };
    }

    const baseLat = toNum(b.base_lat);
    const baseLng = toNum(b.base_lng);
    const hasBase = validLatLng(baseLat, baseLng);

    return {
        ok: true,
        value: {
            type: b.type as PostType,
            urgency: b.urgency === 'urgent' ? 'urgent' : 'normal',
            title: str(b.title),
            description: str(b.description),
            species: str(b.species),
            size: str(b.size),
            color_tags: Array.isArray(b.color_tags) ? b.color_tags.filter((t): t is string => typeof t === 'string') : [],
            event_datetime: str(b.event_datetime) || null,
            pin_lat: lat!,
            pin_lng: lng!,
            base_lat: hasBase ? baseLat : null,
            base_lng: hasBase ? baseLng : null,
            search_radius_km: toNum(b.search_radius_km),
            city: str(b.city),
            neighborhood: str(b.neighborhood),
            photos: photos as string[],
            contact_whatsapp: str(b.contact_whatsapp),
            contact_phone: str(b.contact_phone),
        },
    };
}

export function validateNewSighting(body: unknown): Result<NewSightingInput> {
    const b = (body ?? {}) as Record<string, unknown>;
    for (const field of ['lat', 'lng', 'note']) {
        if (missing(b[field])) return { ok: false, error: `Campo obrigatório: ${field}` };
    }
    const lat = toNum(b.lat);
    const lng = toNum(b.lng);
    if (!validLatLng(lat, lng)) return { ok: false, error: 'Localização inválida' };
    const photo = str(b.photo_url);
    if (photo && !photo.startsWith('https://')) return { ok: false, error: 'Foto inválida' };
    return {
        ok: true,
        value: { lat: lat!, lng: lng!, datetime: str(b.datetime) || new Date().toISOString(), note: str(b.note), photo_url: photo || null },
    };
}
