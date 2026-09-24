import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { currentUserId } from '@/lib/auth/session';

// Gera o token para o navegador subir a foto direto no Vercel Blob.
export async function POST(request: Request) {
    const body = (await request.json().catch(() => null)) as HandleUploadBody | null;
    if (!body) return NextResponse.json({ error: 'Requisição inválida' }, { status: 400 });
    // O token de upload só sai para quem está logado
    if (body.type === 'blob.generate-client-token' && !(await currentUserId())) {
        return NextResponse.json({ error: 'Entre na sua conta para enviar fotos' }, { status: 401 });
    }
    try {
        const json = await handleUpload({
            body,
            request,
            onBeforeGenerateToken: async () => ({
                allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
                maximumSizeInBytes: 5 * 1024 * 1024,
                addRandomSuffix: true,
            }),
            onUploadCompleted: async () => {
                // Não chamado em localhost; o post é quem registra as URLs.
            },
        });
        return NextResponse.json(json);
    } catch (err) {
        return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
}
