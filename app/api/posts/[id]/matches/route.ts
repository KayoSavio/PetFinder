import { NextRequest, NextResponse } from 'next/server';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// GET /api/posts/[id]/matches — Possíveis matches visuais de um post
// Proxy para o AI Service (usa embeddings já salvos + localização do post)
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    const qs = new URLSearchParams();
    const threshold = searchParams.get('threshold');
    const maxResults = searchParams.get('max_results');
    const radiusKm = searchParams.get('radius_km');
    if (threshold) qs.set('threshold', threshold);
    if (maxResults) qs.set('max_results', maxResults);
    if (radiusKm) qs.set('radius_km', radiusKm);

    try {
        const response = await fetch(
            `${AI_SERVICE_URL}/match/by-post/${id}?${qs.toString()}`,
            { cache: 'no-store' }
        );

        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Erro desconhecido' }));
            return NextResponse.json(
                { error: error.detail || 'Erro ao buscar matches' },
                { status: response.status }
            );
        }

        return NextResponse.json(await response.json());
    } catch (error) {
        console.error('Erro no proxy /api/posts/[id]/matches:', error);
        return NextResponse.json(
            { error: 'Serviço de IA indisponível. Verifique se o ai-service está rodando.' },
            { status: 503 }
        );
    }
}
