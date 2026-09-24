export type PostType = 'lost' | 'found' | 'help_request';
export type PostStatus = 'active' | 'resolved';
export type PostUrgency = 'normal' | 'urgent';

export interface Post {
    id: string;
    user_id: string;
    type: PostType;
    status: PostStatus;
    urgency: PostUrgency;
    title: string;
    description: string;
    species: string;
    size: string;
    color_tags: string[];
    event_datetime: string;
    pin_lat: number;
    pin_lng: number;
    base_lat?: number;
    base_lng?: number;
    search_radius_km?: number;
    city: string;
    neighborhood: string;
    photos: string[];
    contact_whatsapp: string;
    contact_phone: string;
    created_at: string;
    updated_at: string;
    distance_km?: number;
    sighting_count?: number;
}

export interface Sighting {
    id: string;
    post_id: string;
    user_id: string;
    lat: number;
    lng: number;
    datetime: string;
    note: string;
    photo_url?: string;
    created_at: string;
}

export interface AlertPreference {
    id: string;
    user_id: string;
    center_lat: number;
    center_lng: number;
    radius_km: number;
    filters: {
        species?: string[];
        type?: PostType[];
    };
    enabled: boolean;
    created_at: string;
}

export interface MatchResult {
    post_id: string;
    photo_url: string;
    similarity: number;      // 0-1 (similaridade visual)
    distance_km?: number;    // distância do post de origem
    post?: Post;             // detalhes do post que deu match
}

export interface Report {
    id: string;
    post_id: string;
    user_id: string;
    reason: string;
    created_at: string;
}

export interface PostFilters {
    type?: PostType;
    species?: string;
    urgency?: PostUrgency;
    status?: PostStatus;
}

export interface BBox {
    sw_lat: number;
    sw_lng: number;
    ne_lat: number;
    ne_lng: number;
}

export interface NearQuery {
    lat: number;
    lng: number;
    radius_km: number;
}

export interface GeoJSONPost {
    type: 'Feature';
    properties: Post;
    geometry: {
        type: 'Point';
        coordinates: [number, number]; // [lng, lat]
    };
}

export interface PostFormData {
    type: PostType;
    urgency: PostUrgency;
    title: string;
    description: string;
    species: string;
    size: string;
    color_tags: string[];
    event_datetime: string;
    pin_lat: number;
    pin_lng: number;
    base_lat?: number;
    base_lng?: number;
    search_radius_km?: number;
    photos: File[];
    contact_whatsapp: string;
    contact_phone: string;
}
