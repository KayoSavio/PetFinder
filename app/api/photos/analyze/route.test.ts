import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

function req(body: unknown) {
    return new Request('http://localhost/api/photos/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    }) as never;
}

afterEach(() => vi.unstubAllGlobals());

describe('POST /api/photos/analyze', () => {
    it('exige photo_url https', async () => {
        expect((await POST(req({}))).status).toBe(400);
        expect((await POST(req({ photo_url: 'blob:http://x' }))).status).toBe(400);
    });

    it('recusa URL fora do Vercel Blob (evita o ai-service baixar qualquer endereço)', async () => {
        const fetchSpy = vi.fn();
        vi.stubGlobal('fetch', fetchSpy);
        expect((await POST(req({ photo_url: 'https://10.0.0.5/admin' }))).status).toBe(400);
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('repassa a resposta do ai-service', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => Response.json({ has_animal: true, species: 'cat', confidence: 0.9 })));
        const res = await POST(req({ photo_url: 'https://x.public.blob.vercel-storage.com/cat.jpg' }));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ has_animal: true, species: 'cat', confidence: 0.9 });
    });

    it('ai-service fora → 503 com mensagem', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
        const res = await POST(req({ photo_url: 'https://x.public.blob.vercel-storage.com/cat.jpg' }));
        expect(res.status).toBe(503);
        expect((await res.json()).error).toBe('Análise indisponível agora');
    });
});
