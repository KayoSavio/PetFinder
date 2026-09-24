import { after, NextRequest, NextResponse } from 'next/server';
import { createPost, listPosts } from '@/lib/data/posts';
import { validateNewPost } from '@/lib/data/validation';
import { triggerEmbeddings } from '@/lib/ai';
import type { PostStatus, PostType, PostUrgency } from '@/types';

function dbError(err: unknown) {
    console.error('[DB]', err);
    return NextResponse.json({ error: 'Banco de dados indisponível. Tente de novo em instantes.' }, { status: 503 });
}

// GET /api/posts?bbox=sw_lat,sw_lng,ne_lat,ne_lng&type=lost&species=cachorro
// GET /api/posts?near=lat,lng&radius=50&type=lost
export async function GET(request: NextRequest) {
    const sp = new URL(request.url).searchParams;
    const nums = (v: string | null) => (v ? v.split(',').map(Number) : null);
    const bbox = nums(sp.get('bbox'));
    const near = nums(sp.get('near'));
    const page = Math.max(parseInt(sp.get('page') || '1'), 1);
    const limit = parseInt(sp.get('limit') || '20');

    if ((bbox && (bbox.length !== 4 || bbox.some(Number.isNaN))) || (near && (near.length !== 2 || near.some(Number.isNaN)))) {
        return NextResponse.json({ error: 'Parâmetros de localização inválidos' }, { status: 400 });
    }

    try {
        const { posts, total } = await listPosts({
            type: (sp.get('type') as PostType) || undefined,
            species: sp.get('species') || undefined,
            urgency: (sp.get('urgency') as PostUrgency) || undefined,
            status: (sp.get('status') as PostStatus) || 'active',
            bbox: bbox ? { sw_lat: bbox[0], sw_lng: bbox[1], ne_lat: bbox[2], ne_lng: bbox[3] } : undefined,
            near: near ? { lat: near[0], lng: near[1], radius_km: parseFloat(sp.get('radius') || '50') } : undefined,
            limit,
            offset: (page - 1) * limit,
        });
        return NextResponse.json({
            type: 'FeatureCollection',
            features: posts.map(post => ({
                type: 'Feature',
                properties: post,
                geometry: { type: 'Point', coordinates: [post.pin_lng, post.pin_lat] },
            })),
            total,
            page,
            limit,
        });
    } catch (err) {
        return dbError(err);
    }
}

// POST /api/posts
export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => null);
    const parsed = validateNewPost(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    try {
        // Sem login ainda: user_id NULL (o plano do Neon Auth preenche)
        const post = await createPost(parsed.value, null);
        if (post.photos.length > 0) after(() => triggerEmbeddings(post.id, post.photos));
        return NextResponse.json(post, { status: 201 });
    } catch (err) {
        return dbError(err);
    }
}
