export const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

/**
 * Pede ao ai-service para gerar embeddings das fotos de um post.
 * Fire-and-forget: se o ai-service estiver fora, /embeddings/batch recupera depois.
 */
export function triggerEmbeddings(postId: string, photos: string[]): void {
    for (const photoUrl of photos) {
        const form = new FormData();
        form.append('post_id', postId);
        form.append('photo_url', photoUrl);
        fetch(`${AI_SERVICE_URL}/embeddings/generate-from-url`, { method: 'POST', body: form })
            .catch(err => console.warn(`[AI] Falha ao gerar embedding para ${photoUrl}:`, err.message));
    }
}
