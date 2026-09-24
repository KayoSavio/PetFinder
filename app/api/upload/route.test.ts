import { describe, expect, it, vi } from 'vitest';

const { session } = vi.hoisted(() => ({ session: { userId: null as string | null } }));
vi.mock('@/lib/auth/session', () => ({ currentUserId: async () => session.userId }));

import { POST } from './route';

describe('POST /api/upload', () => {
    it('sem login não gera token de upload', async () => {
        const res = await POST(new Request('http://localhost/api/upload', {
            method: 'POST',
            body: JSON.stringify({ type: 'blob.generate-client-token', payload: { pathname: 'posts/a.jpg', clientPayload: null, multipart: false } }),
        }));
        expect(res.status).toBe(401);
    });
});
