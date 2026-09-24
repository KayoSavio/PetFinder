import imageCompression from 'browser-image-compression';
import { upload } from '@vercel/blob/client';

const COMPRESSION_OPTIONS = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
};

export async function compressImage(file: File): Promise<File> {
    return imageCompression(file, COMPRESSION_OPTIONS);
}

// Comprime e sobe a foto direto do navegador para o Vercel Blob; devolve a URL pública.
export async function uploadImage(file: File): Promise<string> {
    const compressed = await compressImage(file);
    const name = `posts/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
    const blob = await upload(name, compressed, {
        access: 'public',
        handleUploadUrl: '/api/upload',
        contentType: compressed.type,
    });
    return blob.url;
}
