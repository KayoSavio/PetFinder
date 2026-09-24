import { NextRequest, NextResponse } from 'next/server';
import { MOCK_SIGHTINGS } from '@/lib/mock-data';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// GET /api/posts/[id]/sightings
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const sightings = MOCK_SIGHTINGS
        .filter(s => s.post_id === id)
        .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());

    return NextResponse.json({ sightings, total: sightings.length });
}

// POST /api/posts/[id]/sightings
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        const body = await request.json();

        const required = ['lat', 'lng', 'note'];
        for (const field of required) {
            if (!body[field]) {
                return NextResponse.json(
                    { error: `Campo obrigatório: ${field}` },
                    { status: 400 }
                );
            }
        }

        const newSighting = {
            id: crypto.randomUUID(),
            post_id: id,
            user_id: 'mock-user',
            lat: body.lat,
            lng: body.lng,
            datetime: body.datetime || new Date().toISOString(),
            note: body.note,
            photo_url: body.photo_url || null,
            created_at: new Date().toISOString(),
        };

        // Se o avistamento tem foto, busca matches com a IA
        let ai_matches = null;
        if (body.photo_url) {
            try {
                const formData = new FormData();
                formData.append('post_id', id);
                formData.append('photo_url', body.photo_url);

                // Gera embedding da foto do avistamento
                await fetch(`${AI_SERVICE_URL}/embeddings/generate-from-url`, {
                    method: 'POST',
                    body: formData,
                });

                // Busca matches (fazendo download da foto e comparando)
                const matchRes = await fetch(`${AI_SERVICE_URL}/match`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ photo_url: body.photo_url }),
                }).catch(() => null);

                if (matchRes && matchRes.ok) {
                    ai_matches = await matchRes.json();
                }
            } catch (err) {
                console.warn('[AI] Falha ao buscar matches para avistamento:', err);
            }
        }

        return NextResponse.json({
            ...newSighting,
            ai_matches,
        }, { status: 201 });
    } catch {
        return NextResponse.json({ error: 'Erro ao criar avistamento' }, { status: 500 });
    }
}

