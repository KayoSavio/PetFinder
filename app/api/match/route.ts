import { NextRequest, NextResponse } from 'next/server';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// POST /api/match — Proxy para o AI Service
// Recebe uma foto e retorna os posts mais similares
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const threshold = formData.get('threshold') as string | null;
        const maxResults = formData.get('max_results') as string | null;

        if (!file) {
            return NextResponse.json(
                { error: 'Campo obrigatório: file (foto do animal)' },
                { status: 400 }
            );
        }

        // Monta o FormData para enviar ao AI Service
        const aiFormData = new FormData();
        aiFormData.append('file', file);

        if (threshold) {
            aiFormData.append('threshold', threshold);
        }
        if (maxResults) {
            aiFormData.append('max_results', maxResults);
        }

        // Chama o AI Service
        const response = await fetch(`${AI_SERVICE_URL}/match`, {
            method: 'POST',
            body: aiFormData,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Erro desconhecido' }));
            return NextResponse.json(
                { error: error.detail || 'Erro ao buscar matches' },
                { status: response.status }
            );
        }

        const matches = await response.json();
        return NextResponse.json(matches);
    } catch (error) {
        console.error('Erro no proxy /api/match:', error);
        return NextResponse.json(
            { error: 'Serviço de IA indisponível. Verifique se o ai-service está rodando.' },
            { status: 503 }
        );
    }
}
