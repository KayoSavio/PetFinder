import { NextRequest, NextResponse } from 'next/server';
import { MOCK_POSTS } from '@/lib/mock-data';
import { haversineDistance } from '@/lib/utils';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

/**
 * Dispara geração de embeddings para as fotos de um post.
 * Fire-and-forget: não bloqueia a resposta ao usuário.
 */
async function triggerEmbeddingGeneration(postId: string, photos: string[]) {
    for (const photoUrl of photos) {
        try {
            const formData = new FormData();
            formData.append('post_id', postId);
            formData.append('photo_url', photoUrl);

            fetch(`${AI_SERVICE_URL}/embeddings/generate-from-url`, {
                method: 'POST',
                body: formData,
            }).catch((err) => {
                console.warn(`[AI] Falha ao gerar embedding para ${photoUrl}:`, err.message);
            });
        } catch (err) {
            console.warn(`[AI] Erro ao disparar embedding para ${photoUrl}:`, err);
        }
    }
}

// GET /api/posts?bbox=sw_lat,sw_lng,ne_lat,ne_lng&type=lost&species=cachorro
// GET /api/posts?near=lat,lng&radius=50&type=lost
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);

    const type = searchParams.get('type');
    const species = searchParams.get('species');
    const urgency = searchParams.get('urgency');
    const status = searchParams.get('status') || 'active';

    let posts = MOCK_POSTS.filter(p => {
        if (status && p.status !== status) return false;
        if (type && p.type !== type) return false;
        if (species && p.species.toLowerCase() !== species.toLowerCase()) return false;
        if (urgency && p.urgency !== urgency) return false;
        return true;
    });

    // BBox query
    const bbox = searchParams.get('bbox');
    if (bbox) {
        const [sw_lat, sw_lng, ne_lat, ne_lng] = bbox.split(',').map(Number);
        posts = posts.filter(p =>
            p.pin_lat >= sw_lat && p.pin_lat <= ne_lat &&
            p.pin_lng >= sw_lng && p.pin_lng <= ne_lng
        );
    }

    // Near query
    const near = searchParams.get('near');
    const radius = parseFloat(searchParams.get('radius') || '50');
    if (near) {
        const [lat, lng] = near.split(',').map(Number);
        posts = posts
            .map(p => ({
                ...p,
                distance_km: haversineDistance(lat, lng, p.pin_lat, p.pin_lng),
            }))
            .filter(p => (p.distance_km || 0) <= radius)
            .sort((a, b) => (a.distance_km || 0) - (b.distance_km || 0));
    }

    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    const paginated = posts.slice(offset, offset + limit);

    // GeoJSON response
    const geojson = {
        type: 'FeatureCollection',
        features: paginated.map(post => ({
            type: 'Feature',
            properties: post,
            geometry: {
                type: 'Point',
                coordinates: [post.pin_lng, post.pin_lat],
            },
        })),
        total: posts.length,
        page,
        limit,
    };

    return NextResponse.json(geojson);
}

// POST /api/posts
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate required fields
        const required = ['type', 'title', 'species', 'pin_lat', 'pin_lng'];
        for (const field of required) {
            if (!body[field]) {
                return NextResponse.json(
                    { error: `Campo obrigatório: ${field}` },
                    { status: 400 }
                );
            }
        }

        // Mock: create post with ID
        const newPost = {
            id: crypto.randomUUID(),
            user_id: 'mock-user',
            status: 'active',
            urgency: body.urgency || 'normal',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            sighting_count: 0,
            ...body,
        };

        // Dispara geração de embeddings da IA (fire-and-forget)
        if (newPost.photos && newPost.photos.length > 0) {
            triggerEmbeddingGeneration(newPost.id, newPost.photos);
        }

        return NextResponse.json(newPost, { status: 201 });
    } catch {
        return NextResponse.json({ error: 'Erro ao criar post' }, { status: 500 });
    }
}
