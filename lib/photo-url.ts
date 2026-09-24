// Fotos só podem vir do Vercel Blob: o ai-service baixa essas URLs e todo
// visitante as vê em <img>, então qualquer outro endereço é recusado.
const BLOB_HOST_SUFFIX = '.public.blob.vercel-storage.com';

export function isAllowedPhotoUrl(value: string): boolean {
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        return false;
    }
    return url.protocol === 'https:' && url.hostname.endsWith(BLOB_HOST_SUFFIX);
}
