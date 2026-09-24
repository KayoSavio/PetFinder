import { NextRequest, NextResponse } from 'next/server';
import { AI_SERVICE_URL } from '@/lib/ai';

// POST /api/photos/analyze — { photo_url } → tem cachorro/gato na foto?
export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => null);
    const photoUrl = typeof body?.photo_url === 'string' ? body.photo_url : '';
    if (!photoUrl.startsWith('https://')) {
        return NextResponse.json({ error: 'photo_url inválida' }, { status: 400 });
    }

    const form = new FormData();
    form.append('photo_url', photoUrl);
    try {
        const res = await fetch(`${AI_SERVICE_URL}/analyze`, { method: 'POST', body: form });
        if (!res.ok) throw new Error(`ai-service HTTP ${res.status}`);
        return NextResponse.json(await res.json());
    } catch (err) {
        console.warn('[AI] /analyze falhou:', err);
        return NextResponse.json({ error: 'Análise indisponível agora' }, { status: 503 });
    }
}
