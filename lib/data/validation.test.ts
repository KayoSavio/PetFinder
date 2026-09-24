import { describe, expect, it } from 'vitest';
import { isUuid, validateNewPost, validateNewSighting } from './validation';

const base = { type: 'lost', title: 'Luna', species: 'Cachorro', pin_lat: -23.55, pin_lng: -46.63 };

describe('validateNewPost', () => {
    it('aceita o mínimo e aplica padrões', () => {
        const r = validateNewPost(base);
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.value.urgency).toBe('normal');
            expect(r.value.photos).toEqual([]);
            expect(r.value.color_tags).toEqual([]);
        }
    });
    it.each(['type', 'title', 'species', 'pin_lat', 'pin_lng'])('exige %s', (field) => {
        const r = validateNewPost({ ...base, [field]: undefined });
        expect(r).toEqual({ ok: false, error: `Campo obrigatório: ${field}` });
    });
    it('rejeita tipo desconhecido', () => {
        expect(validateNewPost({ ...base, type: 'sold' }).ok).toBe(false);
    });
    it('rejeita coordenadas fora do intervalo ou não numéricas', () => {
        expect(validateNewPost({ ...base, pin_lat: 200 })).toEqual({ ok: false, error: 'Localização inválida' });
        expect(validateNewPost({ ...base, pin_lng: 'abc' })).toEqual({ ok: false, error: 'Localização inválida' });
    });
    it('aceita latitude 0 (não confunde com ausente)', () => {
        expect(validateNewPost({ ...base, pin_lat: 0, pin_lng: 0 }).ok).toBe(true);
    });
    it('só aceita fotos https', () => {
        expect(validateNewPost({ ...base, photos: ['blob:http://x/1'] })).toEqual({ ok: false, error: 'Foto inválida' });
        expect(validateNewPost({ ...base, photos: ['https://x.public.blob.vercel-storage.com/a.jpg'] }).ok).toBe(true);
    });
});

describe('validateNewSighting', () => {
    it('exige lat, lng e nota', () => {
        expect(validateNewSighting({ lat: -23.5, lng: -46.6 })).toEqual({ ok: false, error: 'Campo obrigatório: note' });
        expect(validateNewSighting({ lat: -23.5, lng: -46.6, note: 'vi na praça' }).ok).toBe(true);
    });
});

describe('isUuid', () => {
    it('reconhece uuid', () => {
        expect(isUuid('1')).toBe(false);
        expect(isUuid('3f2b8c1e-9d4a-4b7e-8f00-0123456789ab')).toBe(true);
    });
});
