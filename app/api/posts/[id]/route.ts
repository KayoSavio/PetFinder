import { NextRequest, NextResponse } from 'next/server';
import { MOCK_POSTS } from '@/lib/mock-data';

// GET /api/posts/[id]
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const post = MOCK_POSTS.find(p => p.id === id);

    if (!post) {
        return NextResponse.json({ error: 'Post não encontrado' }, { status: 404 });
    }

    return NextResponse.json(post);
}

// PATCH /api/posts/[id] — update status
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const post = MOCK_POSTS.find(p => p.id === id);

    if (!post) {
        return NextResponse.json({ error: 'Post não encontrado' }, { status: 404 });
    }

    try {
        const body = await request.json();

        if (body.status) {
            post.status = body.status;
            post.updated_at = new Date().toISOString();
        }

        return NextResponse.json(post);
    } catch {
        return NextResponse.json({ error: 'Erro ao atualizar post' }, { status: 500 });
    }
}
