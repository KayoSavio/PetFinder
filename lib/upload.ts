import imageCompression from 'browser-image-compression';

const COMPRESSION_OPTIONS = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
};

const THUMB_OPTIONS = {
    maxSizeMB: 0.2,
    maxWidthOrHeight: 400,
    useWebWorker: true,
};

export async function compressImage(file: File): Promise<File> {
    return imageCompression(file, COMPRESSION_OPTIONS);
}

export async function createThumbnail(file: File): Promise<File> {
    return imageCompression(file, THUMB_OPTIONS);
}

export async function uploadImage(file: File): Promise<{ full: string; thumb: string }> {
    // For now, we create object URLs for local preview
    // When Supabase is connected, this will upload to Supabase Storage
    const compressed = await compressImage(file);
    const thumbnail = await createThumbnail(file);

    const fullUrl = URL.createObjectURL(compressed);
    const thumbUrl = URL.createObjectURL(thumbnail);

    return { full: fullUrl, thumb: thumbUrl };
}

export function revokeImageUrls(urls: string[]) {
    urls.forEach((url) => {
        if (url.startsWith('blob:')) {
            URL.revokeObjectURL(url);
        }
    });
}
