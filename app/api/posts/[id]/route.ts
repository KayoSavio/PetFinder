import { NextRequest, NextResponse } from 'next/server';
import { getPost, updatePostStatus } from '@/lib/data/posts';
import { currentUserId } from '@/lib/auth/session';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/posts/[id]
export async function GET(_request: NextRequest, { params }: Ctx) {
    const { id } = await params;
    try {
        const post = await getPost(id);
        if (!post) return NextResponse.json({ error: 'Post não encontrado' }, { status: 404 });
        return NextResponse.json(post);
    } catch (err) {
        console.error('[DB]', err);
        return NextResponse.json({ error: 'Banco de dados indisponível' }, { status: 503 });
    }
}

// PATCH /api/posts/[id] — atualiza status (só o autor)
export async function PATCH(request: NextRequest, { params }: Ctx) {
    const { id } = await params;
    const userId = await currentUserId();
    if (!userId) return NextResponse.json({ error: 'Entre na sua conta' }, { status: 401 });
    const body = await request.json().catch(() => null);
    if (body?.status !== 'active' && body?.status !== 'resolved') {
        return NextResponse.json({ error: 'Status inválido' }, { status: 400 });
    }
    try {
        const post = await updatePostStatus(id, body.status, userId);
        if (post === 'forbidden') return NextResponse.json({ error: 'Só quem publicou pode alterar este post' }, { status: 403 });
        if (!post) return NextResponse.json({ error: 'Post não encontrado' }, { status: 404 });
        return NextResponse.json(post);
    } catch (err) {
        console.error('[DB]', err);
        return NextResponse.json({ error: 'Erro ao atualizar post' }, { status: 503 });
    }
}
