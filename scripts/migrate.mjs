// Aplica as migrations pendentes de db/migrations/ em ordem.
// Uso: node scripts/migrate.mjs [NOME_DA_ENV]   (padrão: DATABASE_URL)
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd());

const envName = process.argv[2] ?? 'DATABASE_URL';
const url = process.env[envName];
if (!url) {
    console.error(`❌ ${envName} não está definida no .env.local`);
    process.exit(1);
}

const dir = path.join(process.cwd(), 'db', 'migrations');
const client = new pg.Client({ connectionString: url });
await client.connect();

try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    const { rows } = await client.query('SELECT name FROM schema_migrations');
    const applied = new Set(rows.map(r => r.name));

    const files = (await readdir(dir)).filter(f => f.endsWith('.sql')).sort();
    for (const file of files) {
        if (applied.has(file)) continue;
        const sql = await readFile(path.join(dir, file), 'utf8');
        console.log(`▶ ${file}`);
        await client.query('BEGIN');
        try {
            await client.query(sql);
            await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        }
    }
    console.log(`✅ ${envName}: migrations em dia`);
} finally {
    await client.end();
}
