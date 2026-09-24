import { Post, Sighting } from '@/types';

export const MOCK_POSTS: Post[] = [
    {
        id: '1',
        user_id: 'user-1',
        type: 'lost',
        status: 'active',
        urgency: 'urgent',
        title: 'Luna',
        description: 'Cadela golden retriever, muito dócil, fugiu durante fogos de artifício. Estava sem coleira. Última vez vista próximo ao parque.',
        species: 'Cachorro',
        size: 'Grande',
        color_tags: ['dourado', 'caramelo'],
        event_datetime: new Date(Date.now() - 86400000 * 2).toISOString(),
        pin_lat: -23.5505,
        pin_lng: -46.6333,
        city: 'São Paulo',
        neighborhood: 'Vila Mariana',
        photos: ['/mock/dog1.jpg'],
        contact_whatsapp: '5511999999999',
        contact_phone: '11999999999',
        created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        sighting_count: 3,
    },
    {
        id: '2',
        user_id: 'user-2',
        type: 'found',
        status: 'active',
        urgency: 'normal',
        title: 'Gato Cinza Encontrado',
        description: 'Gato cinza com listras, encontrado no estacionamento do supermercado. Bem cuidado, parece ter dono. Está com coleira azul sem identificação.',
        species: 'Gato',
        size: 'Médio',
        color_tags: ['cinza', 'listrado'],
        event_datetime: new Date(Date.now() - 86400000).toISOString(),
        pin_lat: -23.5615,
        pin_lng: -46.6555,
        city: 'São Paulo',
        neighborhood: 'Moema',
        photos: ['/mock/cat1.jpg'],
        contact_whatsapp: '5511988888888',
        contact_phone: '11988888888',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        updated_at: new Date(Date.now() - 86400000).toISOString(),
        sighting_count: 0,
    },
    {
        id: '3',
        user_id: 'user-3',
        type: 'help_request',
        status: 'active',
        urgency: 'urgent',
        title: 'Procurando Rex - Pastor Alemão',
        description: 'Precisamos de ajuda para encontrar o Rex. Ele escapou durante uma consulta veterinária. Responde ao nome. Recompensa.',
        species: 'Cachorro',
        size: 'Grande',
        color_tags: ['preto', 'marrom'],
        event_datetime: new Date(Date.now() - 3600000 * 6).toISOString(),
        pin_lat: -23.5430,
        pin_lng: -46.6420,
        base_lat: -23.5430,
        base_lng: -46.6420,
        search_radius_km: 3,
        city: 'São Paulo',
        neighborhood: 'Liberdade',
        photos: ['/mock/dog2.jpg'],
        contact_whatsapp: '5511977777777',
        contact_phone: '11977777777',
        created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 6).toISOString(),
        sighting_count: 5,
    },
    {
        id: '4',
        user_id: 'user-4',
        type: 'lost',
        status: 'active',
        urgency: 'normal',
        title: 'Mimi - Gata Siamesa',
        description: 'Gata siamesa, tímida com estranhos. Não tem coleira. Mora dentro de casa e não é acostumada a ficar na rua.',
        species: 'Gato',
        size: 'Pequeno',
        color_tags: ['bege', 'marrom'],
        event_datetime: new Date(Date.now() - 86400000 * 3).toISOString(),
        pin_lat: -23.5700,
        pin_lng: -46.6480,
        city: 'São Paulo',
        neighborhood: 'Ipiranga',
        photos: ['/mock/cat2.jpg'],
        contact_whatsapp: '5511966666666',
        contact_phone: '11966666666',
        created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
        updated_at: new Date(Date.now() - 86400000 * 3).toISOString(),
        sighting_count: 1,
    },
    {
        id: '5',
        user_id: 'user-5',
        type: 'found',
        status: 'active',
        urgency: 'normal',
        title: 'Pássaro Verde Encontrado',
        description: 'Periquito verde com amarelo, encontrado no quintal. Muito manso, parece ser de estimação.',
        species: 'Pássaro',
        size: 'Pequeno',
        color_tags: ['verde', 'amarelo'],
        event_datetime: new Date(Date.now() - 3600000 * 12).toISOString(),
        pin_lat: -23.5380,
        pin_lng: -46.6250,
        city: 'São Paulo',
        neighborhood: 'Brás',
        photos: ['/mock/bird1.jpg'],
        contact_whatsapp: '5511955555555',
        contact_phone: '11955555555',
        created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 12).toISOString(),
        sighting_count: 0,
    },
    {
        id: '6',
        user_id: 'user-1',
        type: 'lost',
        status: 'resolved',
        urgency: 'normal',
        title: 'Bolinha - Poodle Branco',
        description: 'REENCONTRADO! ❤️ Obrigado a todos que ajudaram na busca. Bolinha foi encontrado em um abrigo próximo.',
        species: 'Cachorro',
        size: 'Pequeno',
        color_tags: ['branco'],
        event_datetime: new Date(Date.now() - 86400000 * 10).toISOString(),
        pin_lat: -23.5550,
        pin_lng: -46.6700,
        city: 'São Paulo',
        neighborhood: 'Pinheiros',
        photos: ['/mock/dog3.jpg'],
        contact_whatsapp: '5511999999999',
        contact_phone: '11999999999',
        created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
        updated_at: new Date(Date.now() - 86400000 * 5).toISOString(),
        sighting_count: 8,
    },
];

export const MOCK_SIGHTINGS: Sighting[] = [
    {
        id: 's1',
        post_id: '1',
        user_id: 'user-10',
        lat: -23.5520,
        lng: -46.6350,
        datetime: new Date(Date.now() - 86400000).toISOString(),
        note: 'Vi um cachorro parecido correndo na Rua Vergueiro, próximo ao metrô.',
        created_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
        id: 's2',
        post_id: '1',
        user_id: 'user-11',
        lat: -23.5535,
        lng: -46.6370,
        datetime: new Date(Date.now() - 3600000 * 12).toISOString(),
        note: 'Cachorro dourado visto no Parque Ibirapuera, estava sozinho.',
        created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    },
    {
        id: 's3',
        post_id: '1',
        user_id: 'user-12',
        lat: -23.5495,
        lng: -46.6310,
        datetime: new Date(Date.now() - 3600000 * 3).toISOString(),
        note: 'Possível avistamento na praça da Sé, cachorro grande e dourado.',
        created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
    },
    {
        id: 's4',
        post_id: '3',
        user_id: 'user-13',
        lat: -23.5445,
        lng: -46.6400,
        datetime: new Date(Date.now() - 3600000 * 2).toISOString(),
        note: 'Pastor alemão visto na Rua da Glória, estava com medo.',
        created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
];

export function getMockPostsInBBox(
    sw_lat: number,
    sw_lng: number,
    ne_lat: number,
    ne_lng: number,
    filters?: { type?: string; species?: string; urgency?: string; status?: string }
): Post[] {
    return MOCK_POSTS.filter((post) => {
        const inBounds =
            post.pin_lat >= sw_lat &&
            post.pin_lat <= ne_lat &&
            post.pin_lng >= sw_lng &&
            post.pin_lng <= ne_lng;

        if (!inBounds) return false;
        if (filters?.type && post.type !== filters.type) return false;
        if (filters?.species && post.species.toLowerCase() !== filters.species.toLowerCase()) return false;
        if (filters?.urgency && post.urgency !== filters.urgency) return false;
        if (filters?.status && post.status !== filters.status) return false;

        return true;
    });
}

export function getMockPostsNear(
    lat: number,
    lng: number,
    radius_km: number = 50,
    filters?: { type?: string; species?: string; urgency?: string; status?: string }
): Post[] {
    const { haversineDistance } = require('@/lib/utils');
    return MOCK_POSTS
        .map((post) => ({
            ...post,
            distance_km: haversineDistance(lat, lng, post.pin_lat, post.pin_lng),
        }))
        .filter((post) => {
            if (post.distance_km > radius_km) return false;
            if (filters?.type && post.type !== filters.type) return false;
            if (filters?.species && post.species.toLowerCase() !== filters.species.toLowerCase()) return false;
            if (filters?.urgency && post.urgency !== filters.urgency) return false;
            if (filters?.status && post.status !== filters.status) return false;
            return true;
        })
        .sort((a, b) => a.distance_km - b.distance_km);
}
