import { beforeEach, describe, expect, it, vi } from 'vitest';

const { session } = vi.hoisted(() => ({ session: { userId: 'vizinho' as string | null } }));
vi.mock('@/lib/auth/session', () => ({ currentUserId: async () => session.userId }));

import { sql } from '@/lib/db';
import { createPost } from '@/lib/data/posts';
import { validateNewPost } from '@/lib/data/validation';
import { POST } from './route';

const post = (id: string, body: unknown) =>
    POST(new Request(`http://localhost/api/posts/${id}/sightings`, { method: 'POST', body: JSON.stringify(body) }) as never, { params: Promise.resolve({ id }) });

beforeEach(async () => {
    session.userId = 'vizinho';
    await sql().query('TRUNCATE posts CASCADE');
});

describe('POST /api/posts/[id]/sightings', () => {
    it('sem login → 401; com login guarda quem viu', async () => {
        const r = validateNewPost({ type: 'lost', title: 'Luna', species: 'Cachorro', pin_lat: -23.5, pin_lng: -46.6 });
        if (!r.ok) throw new Error(r.error);
        const p = await createPost(r.value, 'dono');
        const body = { lat: -23.5, lng: -46.6, note: 'vi na praça' };
        session.userId = null;
        expect((await post(p.id, body)).status).toBe(401);
        session.userId = 'vizinho';
        const res = await post(p.id, body);
        expect(res.status).toBe(201);
        expect((await res.json()).user_id).toBe('vizinho');
    });
});
