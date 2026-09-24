export const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

/**
 * Pede ao ai-service para gerar embeddings das fotos de um post.
 * Chamada dentro de after() nas rotas: roda depois da resposta, sem atrasar o usuário.
 * Falhas só são registradas — /embeddings/batch reprocessa as fotos que faltarem.
 */
export async function triggerEmbeddings(postId: string, photos: string[]): Promise<void> {
    await Promise.all(photos.map(async photoUrl => {
        const form = new FormData();
        form.append('post_id', postId);
        form.append('photo_url', photoUrl);
        try {
            const res = await fetch(`${AI_SERVICE_URL}/embeddings/generate-from-url`, { method: 'POST', body: form });
            if (!res.ok) console.warn(`[AI] Embedding de ${photoUrl} falhou: HTTP ${res.status}`);
        } catch (err) {
            console.warn(`[AI] Falha ao gerar embedding para ${photoUrl}:`, (err as Error).message);
        }
    }));
}
