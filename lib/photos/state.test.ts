import { describe, expect, it } from 'vitest';
import { MAX_PHOTOS, isAcceptedImage, isBusy, labelFor, photoUrls, photosReducer, roomLeft, type PhotosState } from './state';

const empty: PhotosState = { items: [] };
const run = (...actions: Parameters<typeof photosReducer>[1][]) => actions.reduce(photosReducer, empty);

describe('photosReducer', () => {
    it('remover uma foto enquanto outra sobe não a traz de volta', () => {
        const s = run(
            { type: 'add', id: 'a', preview: 'blob:a' },
            { type: 'uploaded', id: 'a', url: 'https://x/a.jpg' },
            { type: 'add', id: 'b', preview: 'blob:b' },
            { type: 'remove', id: 'a' },
            { type: 'uploaded', id: 'b', url: 'https://x/b.jpg' },
        );
        expect(photoUrls(s)).toEqual(['https://x/b.jpg']);
    });

    it('dois lotes simultâneos mantêm todas as fotos', () => {
        const s = run(
            { type: 'add', id: 'a', preview: 'blob:a' },
            { type: 'add', id: 'b', preview: 'blob:b' },
            { type: 'uploaded', id: 'b', url: 'https://x/b.jpg' },
            { type: 'uploaded', id: 'a', url: 'https://x/a.jpg' },
        );
        expect(photoUrls(s).sort()).toEqual(['https://x/a.jpg', 'https://x/b.jpg']);
    });

    it('conta fotos em envio no limite', () => {
        const s = run(...Array.from({ length: MAX_PHOTOS - 1 }, (_, i) => ({ type: 'add' as const, id: `p${i}`, preview: `blob:${i}` })));
        expect(roomLeft(s)).toBe(1);
    });

    it('falha no envio continua visível com mensagem', () => {
        const s = run({ type: 'add', id: 'a', preview: 'blob:a' }, { type: 'failed', id: 'a', message: 'Falha no envio' });
        expect(s.items).toHaveLength(1);
        expect(labelFor(s.items[0])).toBe('Falha no envio');
        expect(photoUrls(s)).toEqual([]);
    });

    it('ocupado enquanto alguma foto sobe', () => {
        const s = run({ type: 'add', id: 'a', preview: 'blob:a' });
        expect(isBusy(s)).toBe(true);
        expect(isBusy(photosReducer(s, { type: 'uploaded', id: 'a', url: 'https://x/a.jpg' }))).toBe(false);
    });

    it('análise de foto já removida é ignorada', () => {
        const s = run(
            { type: 'add', id: 'a', preview: 'blob:a' },
            { type: 'uploaded', id: 'a', url: 'https://x/a.jpg' },
            { type: 'remove', id: 'a' },
            { type: 'analyzed', id: 'a', hasAnimal: true, species: 'dog' },
        );
        expect(s.items).toEqual([]);
    });
});

describe('labelFor', () => {
    const base = { id: 'a', preview: 'blob:a', url: 'https://x/a.jpg' };
    it('animal detectado com espécie incerta não diz que não há animal', () => {
        expect(labelFor({ ...base, status: 'done', hasAnimal: true, species: null })).toBe('🐾 Animal detectado');
    });
    it('sem animal avisa', () => {
        expect(labelFor({ ...base, status: 'done', hasAnimal: false, species: null })).toBe('⚠️ Não encontramos um cachorro ou gato nesta foto');
    });
    it('espécie conhecida', () => {
        expect(labelFor({ ...base, status: 'done', hasAnimal: true, species: 'cat' })).toBe('🐱 Gato detectado');
    });
});

describe('isAcceptedImage', () => {
    it('só aceita jpeg, png e webp', () => {
        expect(isAcceptedImage('image/jpeg')).toBe(true);
        expect(isAcceptedImage('image/webp')).toBe(true);
        expect(isAcceptedImage('image/gif')).toBe(false);
        expect(isAcceptedImage('image/heic')).toBe(false);
    });
});
