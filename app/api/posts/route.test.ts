import { beforeEach, describe, expect, it, vi } from 'vitest';

const { afterCallbacks, triggerEmbeddings, session } = vi.hoisted(() => ({
    afterCallbacks: [] as (() => unknown)[],
    triggerEmbeddings: vi.fn(async (..._args: unknown[]) => {}),
    session: { userId: 'user-1' as string | null },
}));
vi.mock('@/lib/auth/session', () => ({ currentUserId: async () => session.userId }));
vi.mock('next/server', async (orig) => ({
    ...(await orig<typeof import('next/server')>()),
    after: (cb: () => unknown) => { afterCallbacks.push(cb); },
}));
vi.mock('@/lib/ai', () => ({ triggerEmbeddings, AI_SERVICE_URL: 'http://ai' }));

import { sql } from '@/lib/db';
import { POST } from './route';

function req(body: unknown) {
    return new Request('http://localhost/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    }) as never;
}

beforeEach(async () => {
    afterCallbacks.length = 0;
    session.userId = 'user-1';
    triggerEmbeddings.mockClear();
    await sql().query('TRUNCATE posts CASCADE');
});

describe('POST /api/posts', () => {
    it('agenda a geração de embeddings com after() (sobrevive ao fim da resposta na Vercel)', async () => {
        const photo = 'https://abc.public.blob.vercel-storage.com/a.jpg';
        const res = await POST(req({ type: 'lost', title: 'Luna', species: 'Cachorro', pin_lat: -23.5, pin_lng: -46.6, photos: [photo] }));
        expect(res.status).toBe(201);
        expect(triggerEmbeddings).not.toHaveBeenCalled();
        expect(afterCallbacks).toHaveLength(1);
        await afterCallbacks[0]();
        expect(triggerEmbeddings).toHaveBeenCalledWith((await res.json()).id, [photo]);
    });

    it('data inválida → 400 (não 503)', async () => {
        const res = await POST(req({ type: 'lost', title: 'x', species: 'Gato', pin_lat: 0, pin_lng: 0, event_datetime: 'ontem' }));
        expect(res.status).toBe(400);
    });

    it('sem login → 401 e nada é salvo', async () => {
        session.userId = null;
        const res = await POST(req({ type: 'lost', title: 'Luna', species: 'Cachorro', pin_lat: -23.5, pin_lng: -46.6 }));
        expect(res.status).toBe(401);
        const rows = await sql().query('SELECT COUNT(*)::int AS n FROM posts');
        expect((rows[0] as { n: number }).n).toBe(0);
    });

    it('com login o post guarda o autor', async () => {
        const res = await POST(req({ type: 'lost', title: 'Luna', species: 'Cachorro', pin_lat: -23.5, pin_lng: -46.6 }));
        expect((await res.json()).user_id).toBe('user-1');
    });
});
