import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

// Gera o token para o navegador subir a foto direto no Vercel Blob.
// TODO do plano de login: exigir usuário logado em onBeforeGenerateToken.
export async function POST(request: Request) {
    const body = (await request.json()) as HandleUploadBody;
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
