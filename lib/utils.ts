export function timeAgo(dateString: string): string {
    const now = new Date();
    const date = new Date(dateString);
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'agora mesmo';
    if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        return `${mins} min atrás`;
    }
    if (seconds < 86400) {
        const hours = Math.floor(seconds / 3600);
        return `${hours}h atrás`;
    }
    if (seconds < 604800) {
        const days = Math.floor(seconds / 86400);
        return `${days}d atrás`;
    }
    return date.toLocaleDateString('pt-BR');
}

export function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function haversineDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(deg: number): number {
    return (deg * Math.PI) / 180;
}

export function formatDistance(km: number): string {
    if (km < 1) return `${Math.round(km * 1000)}m`;
    return `${km.toFixed(1)}km`;
}

export function getPostTypeLabel(type: string): string {
    switch (type) {
        case 'lost': return 'Perdido';
        case 'found': return 'Encontrado';
        case 'help_request': return 'Pedido de Ajuda';
        default: return type;
    }
}

export function getPostTypeColor(type: string): string {
    switch (type) {
        case 'lost': return 'var(--color-lost)';
        case 'found': return 'var(--color-found)';
        case 'help_request': return 'var(--color-help)';
        default: return 'var(--color-primary)';
    }
}

export function getSpeciesEmoji(species: string): string {
    switch (species?.toLowerCase()) {
        case 'cachorro': case 'cão': case 'dog': return '🐕';
        case 'gato': case 'cat': return '🐈';
        case 'pássaro': case 'ave': case 'bird': return '🐦';
        case 'coelho': case 'rabbit': return '🐰';
        case 'hamster': return '🐹';
        case 'tartaruga': case 'turtle': return '🐢';
        default: return '🐾';
    }
}

export function generateWhatsAppLink(phone: string, message?: string): string {
    const cleaned = phone.replace(/\D/g, '');
    const msg = message ? `?text=${encodeURIComponent(message)}` : '';
    return `https://wa.me/${cleaned}${msg}`;
}

export function cn(...classes: (string | undefined | false | null)[]): string {
    return classes.filter(Boolean).join(' ');
}
