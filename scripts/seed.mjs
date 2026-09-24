// Insere os posts/avistamentos de lib/mock-data.ts no banco (DATABASE_URL).
// Apaga os posts existentes antes — use só no branch dev.
import pg from 'pg';
import nextEnv from '@next/env';
import { MOCK_POSTS, MOCK_SIGHTINGS } from '../lib/mock-data.ts';

nextEnv.loadEnvConfig(process.cwd());

// O seed apaga os posts: nunca no branch de produção (DATABASE_URL vem do `neon link`)
if (process.env.NEON_BRANCH === 'production' && !process.argv.includes('--force')) {
    console.error('❌ DATABASE_URL aponta para o branch production. O seed apaga todos os posts — recusado.');
    console.error('   Use um branch de desenvolvimento (neon link --branch <nome>) ou passe --force se tiver certeza.');
    process.exit(1);
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
    await client.query('BEGIN');
    await client.query('TRUNCATE posts CASCADE');
    const ids = new Map();
    for (const p of MOCK_POSTS) {
        const { rows } = await client.query(
            `INSERT INTO posts (type, status, urgency, title, description, species, size, color_tags,
                event_datetime, location, base_location, search_radius_km, city, neighborhood,
                contact_whatsapp, contact_phone, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,
                ST_SetSRID(ST_MakePoint($10,$11),4326)::geography,
                CASE WHEN $12::float8 IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint($12,$13),4326)::geography END,
                $14,$15,$16,$17,$18,$19)
             RETURNING id`,
            [p.type, p.status, p.urgency, p.title, p.description, p.species, p.size, p.color_tags,
             p.event_datetime, p.pin_lng, p.pin_lat, p.base_lng ?? null, p.base_lat ?? null,
             p.search_radius_km ?? null, p.city, p.neighborhood, p.contact_whatsapp, p.contact_phone, p.created_at],
        );
        ids.set(p.id, rows[0].id);
    }
    let sightings = 0;
    for (const s of MOCK_SIGHTINGS) {
        const postId = ids.get(s.post_id);
        if (!postId) continue;
        await client.query(
            `INSERT INTO sightings (post_id, location, datetime, note)
             VALUES ($1, ST_SetSRID(ST_MakePoint($2,$3),4326)::geography, $4, $5)`,
            [postId, s.lng, s.lat, s.datetime, s.note],
        );
        sightings++;
    }
    await client.query('COMMIT');
    console.log(`✅ Seed: ${ids.size} posts, ${sightings} avistamentos (sem fotos — as fotos do mock não existem)`);
} catch (err) {
    await client.query('ROLLBACK');
    throw err;
} finally {
    await client.end();
}
