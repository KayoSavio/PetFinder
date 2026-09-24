import { sql } from '@/lib/db';
import type { BBox, NearQuery, Post, PostStatus, PostType, PostUrgency, Sighting } from '@/types';
import { isUuid, type NewPostInput, type NewSightingInput } from './validation';

export interface ListPostsQuery {
    type?: PostType;
    species?: string;
    urgency?: PostUrgency;
    status?: PostStatus;          // padrão: 'active'
    bbox?: BBox;
    near?: NearQuery;
    limit?: number;               // padrão 20, máx 500
    offset?: number;
}

const POST_SELECT = `
    p.id::text AS id, COALESCE(p.user_id, '') AS user_id, p.type, p.status, p.urgency, p.title,
    COALESCE(p.description, '') AS description, COALESCE(p.species, '') AS species,
    COALESCE(p.size, '') AS size, p.color_tags, p.event_datetime, p.pin_lat, p.pin_lng,
    ST_Y(p.base_location::geometry) AS base_lat, ST_X(p.base_location::geometry) AS base_lng,
    p.search_radius_km, COALESCE(p.city, '') AS city, COALESCE(p.neighborhood, '') AS neighborhood,
    p.photos, COALESCE(p.contact_whatsapp, '') AS contact_whatsapp,
    COALESCE(p.contact_phone, '') AS contact_phone, p.created_at, p.updated_at,
    (SELECT COUNT(*)::int FROM sightings s WHERE s.post_id = p.id) AS sighting_count`;

const SIGHTING_SELECT = `
    id::text AS id, post_id::text AS post_id, COALESCE(user_id, '') AS user_id,
    pin_lat AS lat, pin_lng AS lng, datetime, COALESCE(note, '') AS note, photo_url, created_at`;

type Row = Record<string, unknown>;

function iso(v: unknown): string {
    if (v instanceof Date) return v.toISOString();
    return typeof v === 'string' ? v : '';
}

function rowToPost(r: Row): Post {
    return {
        ...(r as unknown as Post),
        event_datetime: iso(r.event_datetime),
        created_at: iso(r.created_at),
        updated_at: iso(r.updated_at),
        base_lat: (r.base_lat as number | null) ?? undefined,
        base_lng: (r.base_lng as number | null) ?? undefined,
        search_radius_km: (r.search_radius_km as number | null) ?? undefined,
        distance_km: (r.distance_km as number | null | undefined) ?? undefined,
    };
}

function rowToSighting(r: Row): Sighting {
    return {
        ...(r as unknown as Sighting),
        datetime: iso(r.datetime),
        created_at: iso(r.created_at),
        photo_url: (r.photo_url as string | null) ?? undefined,
    };
}

export async function listPosts(q: ListPostsQuery): Promise<{ posts: Post[]; total: number }> {
    const where: string[] = [];
    const params: unknown[] = [];
    const add = (v: unknown) => { params.push(v); return `$${params.length}`; };

    where.push(`p.status = ${add(q.status ?? 'active')}`);
    if (q.type) where.push(`p.type = ${add(q.type)}`);
    if (q.species) where.push(`lower(p.species) = lower(${add(q.species)})`);
    if (q.urgency) where.push(`p.urgency = ${add(q.urgency)}`);
    if (q.bbox) {
        const b = q.bbox;
        where.push(`ST_Intersects(p.location, ST_MakeEnvelope(${add(b.sw_lng)}, ${add(b.sw_lat)}, ${add(b.ne_lng)}, ${add(b.ne_lat)}, 4326)::geography)`);
    }

    let distance = '';
    let order = 'p.event_datetime DESC NULLS LAST, p.created_at DESC';
    if (q.near) {
        const point = `ST_SetSRID(ST_MakePoint(${add(q.near.lng)}, ${add(q.near.lat)}), 4326)::geography`;
        distance = `, ST_Distance(p.location, ${point}) / 1000.0 AS distance_km`;
        where.push(`ST_DWithin(p.location, ${point}, ${add(q.near.radius_km * 1000)})`);
        order = 'distance_km ASC';
    }

    const whereSql = where.join(' AND ');
    const countParams = [...params];
    const limit = Math.min(Math.max(q.limit ?? 20, 1), 500);
    const offset = Math.max(q.offset ?? 0, 0);

    const [rows, count] = await Promise.all([
        sql().query(
            `SELECT ${POST_SELECT}${distance} FROM posts p WHERE ${whereSql} ORDER BY ${order} LIMIT ${add(limit)} OFFSET ${add(offset)}`,
            params,
        ),
        sql().query(`SELECT COUNT(*)::int AS total FROM posts p WHERE ${whereSql}`, countParams),
    ]);
    return { posts: (rows as Row[]).map(rowToPost), total: (count as Row[])[0].total as number };
}

export async function getPost(id: string): Promise<Post | null> {
    if (!isUuid(id)) return null;
    const rows = await sql().query(`SELECT ${POST_SELECT} FROM posts p WHERE p.id = $1`, [id]);
    return rows.length ? rowToPost(rows[0] as Row) : null;
}

export async function createPost(input: NewPostInput, userId: string | null): Promise<Post> {
    const params: unknown[] = [];
    const add = (v: unknown) => { params.push(v); return `$${params.length}`; };
    const point = (lng: number, lat: number) => `ST_SetSRID(ST_MakePoint(${add(lng)}, ${add(lat)}), 4326)::geography`;

    const values = [
        add(userId), add(input.type), add(input.urgency), add(input.title), add(input.description || null),
        add(input.species), add(input.size || null), add(input.color_tags), `${add(input.event_datetime)}::timestamptz`,
        point(input.pin_lng, input.pin_lat),
        input.base_lat !== null && input.base_lng !== null ? point(input.base_lng, input.base_lat) : 'NULL',
        add(input.search_radius_km), add(input.city || null), add(input.neighborhood || null), add(input.photos),
        add(input.contact_whatsapp || null), add(input.contact_phone || null),
    ];
    const rows = await sql().query(
        `INSERT INTO posts (user_id, type, urgency, title, description, species, size, color_tags,
            event_datetime, location, base_location, search_radius_km, city, neighborhood, photos,
            contact_whatsapp, contact_phone)
         VALUES (${values.join(', ')})
         RETURNING id::text AS id`,
        params,
    );
    return (await getPost((rows[0] as Row).id as string))!;
}

export async function updatePostStatus(id: string, status: PostStatus): Promise<Post | null> {
    if (!isUuid(id)) return null;
    const rows = await sql().query(`UPDATE posts SET status = $2 WHERE id = $1 RETURNING id`, [id, status]);
    return rows.length ? getPost(id) : null;
}

export async function getSightings(postId: string): Promise<Sighting[]> {
    if (!isUuid(postId)) return [];
    const rows = await sql().query(
        `SELECT ${SIGHTING_SELECT} FROM sightings WHERE post_id = $1 ORDER BY datetime DESC`,
        [postId],
    );
    return (rows as Row[]).map(rowToSighting);
}

export async function createSighting(postId: string, input: NewSightingInput, userId: string | null): Promise<Sighting | null> {
    if (!(await getPost(postId))) return null;
    const rows = await sql().query(
        `INSERT INTO sightings (post_id, user_id, location, datetime, note, photo_url)
         VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, $5::timestamptz, $6, $7)
         RETURNING ${SIGHTING_SELECT}`,
        [postId, userId, input.lng, input.lat, input.datetime, input.note, input.photo_url],
    );
    return rowToSighting(rows[0] as Row);
}
