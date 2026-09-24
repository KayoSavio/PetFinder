import { NextRequest, NextResponse } from 'next/server';
import { createSighting, getSightings } from '@/lib/data/posts';
import { validateNewSighting } from '@/lib/data/validation';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/posts/[id]/sightings
export async function GET(_request: NextRequest, { params }: Ctx) {
    const { id } = await params;
    try {
        const sightings = await getSightings(id);
        return NextResponse.json({ sightings, total: sightings.length });
    } catch (err) {
        console.error('[DB]', err);
        return NextResponse.json({ error: 'Banco de dados indisponível' }, { status: 503 });
    }
}

// POST /api/posts/[id]/sightings
export async function POST(request: NextRequest, { params }: Ctx) {
    const { id } = await params;
    const parsed = validateNewSighting(await request.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    try {
        const sighting = await createSighting(id, parsed.value, null);
        if (!sighting) return NextResponse.json({ error: 'Post não encontrado' }, { status: 404 });
        return NextResponse.json(sighting, { status: 201 });
    } catch (err) {
        console.error('[DB]', err);
        return NextResponse.json({ error: 'Erro ao criar avistamento' }, { status: 503 });
    }
}
