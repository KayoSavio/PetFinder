import { beforeEach, describe, expect, it } from 'vitest';
import { sql } from '@/lib/db';
import { createPost, createSighting, getPost, getSightings, listPosts, updatePostStatus } from './posts';
import { validateNewPost, validateNewSighting } from './validation';

function input(over: Record<string, unknown> = {}) {
    const r = validateNewPost({ type: 'lost', title: 'Luna', species: 'Cachorro', pin_lat: -23.55, pin_lng: -46.63, ...over });
    if (!r.ok) throw new Error(r.error);
    return r.value;
}

beforeEach(async () => {
    await sql().query('TRUNCATE posts CASCADE');
});

describe('posts', () => {
    it('cria e lê com tipos certos', async () => {
        const created = await createPost(input({ photos: ['https://x.public.blob.vercel-storage.com/a.jpg'], color_tags: ['dourado'] }), null);
        const post = await getPost(created.id);
        expect(post).not.toBeNull();
        expect(post!.pin_lat).toBeCloseTo(-23.55, 5);
        expect(typeof post!.pin_lng).toBe('number');
        expect(post!.photos).toEqual(['https://x.public.blob.vercel-storage.com/a.jpg']);
        expect(post!.color_tags).toEqual(['dourado']);
        expect(post!.status).toBe('active');
        expect(typeof post!.created_at).toBe('string');
        expect(post!.sighting_count).toBe(0);
    });

    it('getPost com id inválido ou inexistente devolve null', async () => {
        expect(await getPost('1')).toBeNull();
        expect(await getPost('3f2b8c1e-9d4a-4b7e-8f00-0123456789ab')).toBeNull();
    });

    it('filtra por tipo e espécie (sem diferenciar maiúsculas)', async () => {
        await createPost(input({ type: 'lost', species: 'Cachorro' }), null);
        await createPost(input({ type: 'found', species: 'Gato' }), null);
        const { posts, total } = await listPosts({ type: 'found', species: 'gato' });
        expect(total).toBe(1);
        expect(posts[0].species).toBe('Gato');
    });

    it('bbox e raio', async () => {
        await createPost(input({ title: 'SP', pin_lat: -23.55, pin_lng: -46.63 }), null);
        await createPost(input({ title: 'Rio', pin_lat: -22.90, pin_lng: -43.17 }), null);

        const bbox = await listPosts({ bbox: { sw_lat: -24, sw_lng: -47, ne_lat: -23, ne_lng: -46 } });
        expect(bbox.posts.map(p => p.title)).toEqual(['SP']);

        const near = await listPosts({ near: { lat: -23.56, lng: -46.64, radius_km: 500 } });
        expect(near.posts.map(p => p.title)).toEqual(['SP', 'Rio']);
        expect(near.posts[0].distance_km!).toBeLessThan(2);
        expect(near.posts[1].distance_km!).toBeGreaterThan(300);
    });

    it('não lista resolvidos por padrão', async () => {
        const p = await createPost(input(), null);
        await updatePostStatus(p.id, 'resolved', null);
        expect((await listPosts({})).total).toBe(0);
        expect((await listPosts({ status: 'resolved' })).total).toBe(1);
    });

    it('avistamentos', async () => {
        const p = await createPost(input(), null);
        const s = validateNewSighting({ lat: -23.551, lng: -46.631, note: 'vi na praça' });
        if (!s.ok) throw new Error(s.error);
        const created = await createSighting(p.id, s.value, null);
        expect(created!.lat).toBeCloseTo(-23.551, 5);
        expect((await getSightings(p.id)).length).toBe(1);
        expect((await getPost(p.id))!.sighting_count).toBe(1);
        expect(await createSighting('3f2b8c1e-9d4a-4b7e-8f00-0123456789ab', s.value, null)).toBeNull();
    });

    it('guarda base_location de pedido de ajuda', async () => {
        const p = await createPost(input({ type: 'help_request', base_lat: -23.54, base_lng: -46.64, search_radius_km: 3 }), null);
        expect(p.base_lat).toBeCloseTo(-23.54, 5);
        expect(p.search_radius_km).toBe(3);
    });

    it('sem data do evento usa a data de publicação (evita "Invalid Date")', async () => {
        const p = await createPost(input(), null);
        expect(p.event_datetime).toBe(p.created_at);
        expect(Number.isNaN(new Date(p.event_datetime).getTime())).toBe(false);
    });

    it('guarda o autor e só ele muda o status', async () => {
        const p = await createPost(input(), 'user-a');
        expect(p.user_id).toBe('user-a');
        expect(await updatePostStatus(p.id, 'resolved', 'user-b')).toBe('forbidden');
        expect((await getPost(p.id))!.status).toBe('active');
        const done = await updatePostStatus(p.id, 'resolved', 'user-a');
        expect(done !== 'forbidden' && done?.status).toBe('resolved');
    });
});
