import { beforeEach, describe, expect, it, vi } from 'vitest';

const { session } = vi.hoisted(() => ({ session: { userId: 'dono' as string | null } }));
vi.mock('@/lib/auth/session', () => ({ currentUserId: async () => session.userId }));

import { sql } from '@/lib/db';
import { createPost } from '@/lib/data/posts';
import { validateNewPost } from '@/lib/data/validation';
import { PATCH } from './route';

async function newPost() {
    const r = validateNewPost({ type: 'lost', title: 'Luna', species: 'Cachorro', pin_lat: -23.5, pin_lng: -46.6 });
    if (!r.ok) throw new Error(r.error);
    return createPost(r.value, 'dono');
}
const patch = (id: string, body: unknown) =>
    PATCH(new Request(`http://localhost/api/posts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }) as never, { params: Promise.resolve({ id }) });

beforeEach(async () => {
    session.userId = 'dono';
    await sql().query('TRUNCATE posts CASCADE');
});

describe('PATCH /api/posts/[id]', () => {
    it('sem login → 401', async () => {
        const p = await newPost();
        session.userId = null;
        expect((await patch(p.id, { status: 'resolved' })).status).toBe(401);
    });
    it('outra pessoa → 403', async () => {
        const p = await newPost();
        session.userId = 'intruso';
        expect((await patch(p.id, { status: 'resolved' })).status).toBe(403);
    });
    it('o autor marca como reencontrado', async () => {
        const p = await newPost();
        const res = await patch(p.id, { status: 'resolved' });
        expect(res.status).toBe(200);
        expect((await res.json()).status).toBe('resolved');
    });
});
