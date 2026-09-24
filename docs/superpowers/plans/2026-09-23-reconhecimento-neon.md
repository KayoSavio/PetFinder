# Reconhecimento de Cães e Gatos no Neon — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma foto de cachorro ou gato enviada no app vai para o Vercel Blob, é analisada pelo ai-service (detecta espécie, recorta, gera embedding), fica salva no Neon, e os matches visuais — filtrados por espécie e distância — aparecem na página do post com dados reais.

**Architecture:** Next.js (App Router) acessa o Neon pelo driver `@neondatabase/serverless` através de uma camada `lib/data/`. O navegador sobe fotos direto para o Vercel Blob (`@vercel/blob` client upload). O ai-service (FastAPI) passa a falar com o Neon via `psycopg` e ganha `/analyze` + filtro por espécie no match. Migrations são SQL puro aplicadas por `scripts/migrate.mjs`.

**Tech Stack:** Next.js 16, React 19, TypeScript, `@neondatabase/serverless` ^1, `pg` (scripts), `@vercel/blob`, Vitest; Python 3 + FastAPI, `psycopg[binary,pool]`, pytest, YOLOv8n, DINOv2-small; Neon Postgres 17 + PostGIS 3.5 + pgvector 0.8.

**Spec:** `docs/superpowers/specs/2026-09-23-fundacao-neon-design.md` (fatias: banco, fotos, ai-service, limpeza). Login (Neon Auth) fica para o plano seguinte.

## Global Constraints

- Neon: projeto `petfinder` id `withered-rain-42539725`, região `aws-sa-east-1`, Postgres 17, banco `neondb`.
- `.env.local` (raiz) contém `DATABASE_URL` (branch `dev`), `TEST_DATABASE_URL` (branch `test`), `NEON_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `AI_SERVICE_URL`. Nunca commitar (`.env*` já está no `.gitignore`).
- `ai-service/.env` contém `DATABASE_URL` (mesmo branch `dev`) e `TEST_DATABASE_URL`.
- Embedding: DINOv2-small, **384 dims**, normalizado, similaridade cosseno.
- Espécie no banco de embeddings: `'dog' | 'cat' | NULL`. No post (UI): `'Cachorro' | 'Gato' | ...` (texto livre, como hoje).
- Upload: só `image/jpeg`, `image/png`, `image/webp`, até **5 MB** (após compressão do `browser-image-compression`).
- Textos visíveis ao usuário em **português**.
- Nenhuma dependência do Supabase ao final (JS e Python).
- Sem login neste plano: `user_id` fica `NULL` nos inserts. Rotas de escrita ficam abertas — aceitável só em desenvolvimento; o plano de Neon Auth fecha isso.

## Review Focus

1. **Foto sem cachorro/gato** (paisagem, pessoa, borrão) → `/analyze` diz `has_animal: false`, a UI avisa "Não encontramos um cachorro ou gato nesta foto" mas deixa manter a foto; embedding é salvo com `species NULL`. Teste em Task 3 (imagem sólida gerada).
2. **Gato não pode dar match com cachorro** → `match_photos` com `query_species='dog'` nunca retorna embedding `species='cat'`; embeddings com espécie `NULL` continuam elegíveis. Teste em Task 2.
3. **ID de post inválido na URL** (`/posts/abc`, `/api/posts/1`) → 404, não 500 por erro de cast de UUID. Teste em Task 5.
4. **Coordenadas fora do intervalo / ausentes no POST** (`pin_lat: 200`, string vazia) → 400 com mensagem em português. Teste em Task 5.
5. **ai-service desligado** ao criar post ou analisar foto → post é salvo mesmo assim (201) e a UI do passo Fotos mostra "Análise indisponível agora" em vez de travar. Teste em Task 7 (rota de análise responde 503 com mensagem) e verificação manual em Task 8.

---

## File Structure

| Arquivo | Responsabilidade |
|---------|------------------|
| `db/migrations/0001_init.sql` | schema completo (posts, sightings, photo_embeddings c/ species, alert_preferences, reports, xp_events, user_xp, match_photos) |
| `scripts/migrate.mjs` | aplica migrations pendentes num banco (`DATABASE_URL` ou outro env) |
| `scripts/seed.mjs` | insere dados de `lib/mock-data.ts` no banco dev |
| `ai-service/config.py` | lê `DATABASE_URL` |
| `ai-service/database.py` | acesso Neon via psycopg (mesmas funções públicas + `species`) |
| `ai-service/detector.py` | `detect()` retorna espécie + confiança + box; `detect_and_crop()` usa ele |
| `ai-service/pipeline.py` | `process_image` também devolve `confidence` |
| `ai-service/main.py` | `/analyze`; salva species; match filtra species |
| `ai-service/tests/` | pytest: detector, database (integração), api |
| `lib/db.ts` | cliente Neon lazy |
| `lib/data/validation.ts` | validação pura do body de post/avistamento |
| `lib/data/posts.ts` | CRUD de posts e avistamentos |
| `lib/data/*.test.ts` | Vitest |
| `app/api/posts/**` | rotas usando `lib/data` |
| `app/api/upload/route.ts` | token de upload do Vercel Blob |
| `app/api/photos/analyze/route.ts` | proxy para `ai-service /analyze` |
| `lib/upload.ts` | comprime + sobe no Blob |
| `components/posts/PhotoUploader.tsx` | passo "Fotos": escolher, subir, analisar, mostrar selo de espécie |
| `app/posts/new/page.tsx` | usa `PhotoUploader`, envia post real |
| `app/feed`, `app/map`, `app/posts/[id]` | leem das rotas, mostram fotos reais |

---

### Task 0: Commit de base do código existente

O código atual (`app/`, `components/`, `lib/`, `ai-service/`, …) nunca foi commitado — só o README inicial e os specs. Sem esta base, os diffs das tasks seguintes não são revisáveis.

- [ ] **Step 1: Conferir o que é ignorado**

Run: `git status --short --ignored | head -40`
Expected: `.next/`, `node_modules/`, `.env.local` como ignorados. Se `ai-service/venv/`, `ai-service/__pycache__/` ou `ai-service/yolov8n.pt` aparecerem como não ignorados, adicionar ao `.gitignore`:

```
# ai-service
ai-service/venv/
ai-service/**/__pycache__/
ai-service/*.pt
ai-service/.env
```

(`yolov8n.pt` é baixado automaticamente pelo `ultralytics` na primeira execução.) Os arquivos soltos `ai-service/path.txt`, `where.txt`, `test_results*.txt` são rascunhos locais — perguntar ao usuário antes de commitar ou apagar; na dúvida, adicionar ao `.gitignore`.

- [ ] **Step 2: Commit**

```bash
git add -A
git status --short | grep -E "venv|\.env|\.pt$" && echo "PARE: arquivo que não deveria entrar" || git commit -m "chore: código existente do app e do ai-service (base antes da migração para o Neon)"
```

---

### Task 1: Branches Neon, migration runner e schema

**Files:**
- Create: `db/migrations/0001_init.sql`, `scripts/migrate.mjs`
- Modify: `package.json` (scripts + devDeps), `.env.local`

**Interfaces:**
- Produces: tabelas e função `match_photos(query_embedding vector(384), match_threshold float8, match_count int, query_lat float8, query_lng float8, max_distance_km float8, search_types text[], exclude_post_id uuid, query_species text)` usadas nas Tasks 2–8. Colunas `posts.pin_lat/pin_lng` e `sightings.pin_lat/pin_lng` são `double precision` geradas.
- Comandos: `npm run db:migrate`, `npm run db:migrate:test`.

- [ ] **Step 1: Criar branches `dev` e `test` no Neon e gravar URLs**

Com `NEON_API_KEY` exportada no shell (mesma chave configurada no MCP):

```bash
P=withered-rain-42539725
for B in dev test; do
  curl -s -X POST -H "Authorization: Bearer $NEON_API_KEY" -H "Content-Type: application/json" \
    "https://console.neon.tech/api/v2/projects/$P/branches" \
    -d "{\"branch\":{\"name\":\"$B\"},\"endpoints\":[{\"type\":\"read_write\"}]}" > /dev/null
done
sleep 5
for B in dev test; do
  BID=$(curl -s -H "Authorization: Bearer $NEON_API_KEY" "https://console.neon.tech/api/v2/projects/$P/branches" \
    | python -c "import sys,json;print([b['id'] for b in json.load(sys.stdin)['branches'] if b['name']=='$B'][0])")
  curl -s -H "Authorization: Bearer $NEON_API_KEY" \
    "https://console.neon.tech/api/v2/projects/$P/connection_uri?branch_id=$BID&database_name=neondb&role_name=neondb_owner" \
    | python -c "import sys,json;print(json.load(sys.stdin)['uri'])"
done
```

Escrever `.env.local` (substitui o `DATABASE_URL` atual, que aponta para `main`):

```
# Neon (projeto petfinder, aws-sa-east-1)
DATABASE_URL=<uri do branch dev>
TEST_DATABASE_URL=<uri do branch test>
NEON_API_KEY=<chave>
AI_SERVICE_URL=http://localhost:8000
BLOB_READ_WRITE_TOKEN=<preenchido na Task 7>
```

Criar `ai-service/.env` com `DATABASE_URL` e `TEST_DATABASE_URL` iguais. Confirmar que `ai-service/.env` é ignorado: `git check-ignore ai-service/.env` deve imprimir o caminho (a regra `.env*` da raiz cobre subpastas).

- [ ] **Step 2: Instalar dependências de script**

```bash
npm install -D pg @types/pg
```

- [ ] **Step 3: Escrever o runner**

`scripts/migrate.mjs`:

```js
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
```

`package.json` → `scripts`:

```json
"db:migrate": "node scripts/migrate.mjs",
"db:migrate:test": "node scripts/migrate.mjs TEST_DATABASE_URL",
```

- [ ] **Step 4: Escrever o schema**

`db/migrations/0001_init.sql`:

```sql
-- spykke — schema inicial no Neon (portado de supabase/migrations 001–003)
-- Sem RLS: o banco só é acessado pelo servidor (Next.js e ai-service).
-- user_id é TEXT (id do Neon Auth / Better Auth); FK entra no plano de login.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================
-- POSTS
-- =====================
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('lost', 'found', 'help_request')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
  urgency TEXT NOT NULL DEFAULT 'normal' CHECK (urgency IN ('normal', 'urgent')),
  title TEXT NOT NULL,
  description TEXT,
  species TEXT,
  size TEXT,
  color_tags TEXT[] NOT NULL DEFAULT '{}',
  event_datetime TIMESTAMPTZ,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  pin_lat DOUBLE PRECISION GENERATED ALWAYS AS (ST_Y(location::geometry)) STORED,
  pin_lng DOUBLE PRECISION GENERATED ALWAYS AS (ST_X(location::geometry)) STORED,
  base_location GEOGRAPHY(POINT, 4326),
  search_radius_km DOUBLE PRECISION,
  city TEXT,
  neighborhood TEXT,
  photos TEXT[] NOT NULL DEFAULT '{}',
  contact_whatsapp TEXT,
  contact_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_posts_location ON posts USING GIST (location);
CREATE INDEX idx_posts_status_type ON posts (status, type);
CREATE INDEX idx_posts_event_datetime ON posts (event_datetime DESC);
CREATE INDEX idx_posts_user_id ON posts (user_id);

-- =====================
-- SIGHTINGS (avistamentos)
-- =====================
CREATE TABLE sightings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  pin_lat DOUBLE PRECISION GENERATED ALWAYS AS (ST_Y(location::geometry)) STORED,
  pin_lng DOUBLE PRECISION GENERATED ALWAYS AS (ST_X(location::geometry)) STORED,
  datetime TIMESTAMPTZ NOT NULL,
  note TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sightings_post_id ON sightings (post_id, datetime DESC);

-- =====================
-- PHOTO EMBEDDINGS (DINOv2, 384 dims)
-- =====================
CREATE TABLE photo_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  species TEXT CHECK (species IN ('dog', 'cat')),   -- detectado pelo YOLO; NULL = não detectado
  embedding vector(384) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_photo_embeddings_hnsw
  ON photo_embeddings USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
CREATE INDEX idx_photo_embeddings_post_id ON photo_embeddings (post_id);

-- =====================
-- ALERTAS E DENÚNCIAS
-- =====================
CREATE TABLE alert_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  center GEOGRAPHY(POINT, 4326) NOT NULL,
  radius_km DOUBLE PRECISION NOT NULL DEFAULT 5,
  filters JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_alerts_center ON alert_preferences USING GIST (center);
CREATE INDEX idx_alert_prefs_user_id ON alert_preferences (user_id);

CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================
-- XP (base; regras no sub-projeto de gamificação)
-- =====================
CREATE TABLE xp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  points INT NOT NULL,
  ref_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, kind, ref_id)
);
CREATE VIEW user_xp AS
  SELECT user_id, SUM(points)::int AS xp FROM xp_events GROUP BY user_id;

-- =====================
-- updated_at automático
-- =====================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================
-- MATCH VISUAL + GEOGRÁFICO + ESPÉCIE
-- =====================
CREATE OR REPLACE FUNCTION match_photos(
  query_embedding vector(384),
  match_threshold DOUBLE PRECISION DEFAULT 0.60,
  match_count INT DEFAULT 10,
  query_lat DOUBLE PRECISION DEFAULT NULL,
  query_lng DOUBLE PRECISION DEFAULT NULL,
  max_distance_km DOUBLE PRECISION DEFAULT NULL,
  search_types TEXT[] DEFAULT ARRAY['lost', 'help_request'],
  exclude_post_id UUID DEFAULT NULL,
  query_species TEXT DEFAULT NULL
)
RETURNS TABLE(id UUID, post_id UUID, photo_url TEXT, species TEXT, similarity DOUBLE PRECISION, distance_km DOUBLE PRECISION)
LANGUAGE sql STABLE
AS $$
  SELECT
    pe.id,
    pe.post_id,
    pe.photo_url,
    pe.species,
    1 - (pe.embedding <=> query_embedding) AS similarity,
    CASE WHEN query_lat IS NOT NULL AND query_lng IS NOT NULL THEN
      ST_Distance(p.location, ST_SetSRID(ST_MakePoint(query_lng, query_lat), 4326)::geography) / 1000.0
    END AS distance_km
  FROM photo_embeddings pe
  JOIN posts p ON p.id = pe.post_id
  WHERE p.status = 'active'
    AND p.type = ANY(search_types)
    AND (exclude_post_id IS NULL OR p.id <> exclude_post_id)
    -- espécie: só filtra quando os dois lados são conhecidos
    AND (query_species IS NULL OR pe.species IS NULL OR pe.species = query_species)
    AND 1 - (pe.embedding <=> query_embedding) > match_threshold
    AND (
      query_lat IS NULL OR query_lng IS NULL OR max_distance_km IS NULL
      OR ST_DWithin(p.location, ST_SetSRID(ST_MakePoint(query_lng, query_lat), 4326)::geography, max_distance_km * 1000.0)
    )
  ORDER BY pe.embedding <=> query_embedding
  LIMIT match_count;
$$;
```

(Diferença consciente do spec: `get_posts_in_bbox`/`get_posts_near` não são portadas — a camada `lib/data/posts.ts` faz essas consultas direto em SQL, então as funções ficariam sem uso.)

- [ ] **Step 5: Aplicar nos dois branches e verificar**

```bash
npm run db:migrate && npm run db:migrate:test
node -e "const pg=require('pg');require('@next/env').loadEnvConfig('.');const c=new pg.Client(process.env.TEST_DATABASE_URL);c.connect().then(()=>c.query(\"select table_name from information_schema.tables where table_schema='public' order by 1\")).then(r=>{console.log(r.rows.map(x=>x.table_name).join(', '));return c.end()})"
```

Expected: `✅ DATABASE_URL: migrations em dia`, `✅ TEST_DATABASE_URL: migrations em dia`, e a lista contém `alert_preferences, photo_embeddings, posts, reports, schema_migrations, sightings, spatial_ref_sys, user_xp, xp_events`. Rodar `npm run db:migrate` de novo imprime só a linha ✅ (idempotente).

- [ ] **Step 6: Commit**

```bash
git add db/migrations/0001_init.sql scripts/migrate.mjs package.json package-lock.json
git commit -m "feat(db): schema inicial no Neon e runner de migrations"
```

---

### Task 2: ai-service acessando o Neon (psycopg)

**Files:**
- Modify: `ai-service/config.py`, `ai-service/database.py`, `ai-service/requirements.txt`, `ai-service/.env.example`
- Create: `ai-service/requirements-dev.txt`, `ai-service/tests/__init__.py`, `ai-service/tests/conftest.py`, `ai-service/tests/test_database.py`, `ai-service/pytest.ini`

**Interfaces:**
- Consumes: schema da Task 1.
- Produces (usado na Task 3):
  - `save_embedding(post_id: str, photo_url: str, embedding: list[float], species: str | None = None) -> dict` (chaves `id, post_id, photo_url, species`)
  - `find_similar_photos(query_embedding, match_threshold=0.60, match_count=10, lat=None, lng=None, radius_km=None, search_types=None, exclude_post_id=None, query_species: str | None = None) -> list[dict]` (chaves `id, post_id, photo_url, species, similarity, distance_km`)
  - `get_embeddings_for_post(post_id) -> list[dict]` (chaves `id, photo_url, embedding` (str `"[...]"`), `species`)
  - `get_post_details(post_ids: list[str]) -> list[dict]` (`pin_lat/pin_lng` float, `id` str, datas `datetime`)
  - `delete_embeddings(post_id) -> None`, `get_posts_without_embeddings() -> list[dict]` (`id`, `photos`)

- [ ] **Step 1: Dependências**

`ai-service/requirements.txt`: remover a linha `supabase>=2.12.0`, adicionar `psycopg[binary,pool]>=3.2.0`.

`ai-service/requirements-dev.txt`:

```
-r requirements.txt
pytest>=8.3.0
```

```bash
cd ai-service && venv/Scripts/python -m pip install -r requirements-dev.txt && venv/Scripts/python -m pip uninstall -y supabase
```

`ai-service/pytest.ini`:

```ini
[pytest]
testpaths = tests
pythonpath = .
```

- [ ] **Step 2: Config**

Em `ai-service/config.py`, trocar o bloco `# Supabase` por:

```python
# Banco (Neon Postgres)
DATABASE_URL = os.getenv("DATABASE_URL", "")
```

`ai-service/.env.example`:

```
# spykke AI Service — Variáveis de Ambiente

# Neon Postgres (branch dev). TEST_DATABASE_URL = branch test, usado pelo pytest.
DATABASE_URL=postgresql://USER:SENHA@HOST/neondb?sslmode=require
TEST_DATABASE_URL=postgresql://USER:SENHA@HOST/neondb?sslmode=require

# Servidor
AI_SERVICE_HOST=0.0.0.0
AI_SERVICE_PORT=8000
```

- [ ] **Step 3: Fixture de teste**

`ai-service/tests/__init__.py`: vazio.

`ai-service/tests/conftest.py`:

```python
import os

import pytest
from dotenv import load_dotenv

load_dotenv()

TEST_URL = os.getenv("TEST_DATABASE_URL")


@pytest.fixture
def db(monkeypatch):
    """Aponta database.py para o branch de teste e limpa as tabelas."""
    if not TEST_URL:
        pytest.skip("TEST_DATABASE_URL não configurada")
    import database

    monkeypatch.setattr(database, "DATABASE_URL", TEST_URL)
    database.close_pool()
    with database.get_pool().connection() as conn:
        conn.execute("TRUNCATE posts CASCADE")
    yield database
    database.close_pool()


@pytest.fixture
def make_post(db):
    """Cria um post direto no banco e devolve o id."""
    def _make(type_="found", lat=-23.55, lng=-46.63, status="active"):
        with db.get_pool().connection() as conn:
            row = conn.execute(
                """INSERT INTO posts (type, status, title, location)
                   VALUES (%s, %s, 'teste', ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography)
                   RETURNING id::text AS id""",
                (type_, status, lng, lat),
            ).fetchone()
        return row["id"]
    return _make
```

- [ ] **Step 4: Testes que falham**

`ai-service/tests/test_database.py`:

```python
import math


def unit(i: int, dim: int = 384) -> list[float]:
    """Vetor unitário no eixo i."""
    v = [0.0] * dim
    v[i] = 1.0
    return v


def blend(a: list[float], b: list[float], t: float) -> list[float]:
    """Vetor normalizado entre a e b (t=0 → a)."""
    v = [(1 - t) * x + t * y for x, y in zip(a, b)]
    n = math.sqrt(sum(x * x for x in v))
    return [x / n for x in v]


def test_save_and_read_embedding(db, make_post):
    pid = make_post()
    saved = db.save_embedding(pid, "https://x/1.jpg", unit(0), "dog")
    assert saved["post_id"] == pid and saved["species"] == "dog"
    rows = db.get_embeddings_for_post(pid)
    assert len(rows) == 1 and rows[0]["species"] == "dog"
    assert isinstance(rows[0]["embedding"], str) and rows[0]["embedding"].startswith("[")


def test_match_respects_threshold_and_type(db, make_post):
    found = make_post("found")
    lost = make_post("lost")
    db.save_embedding(found, "https://x/f.jpg", blend(unit(0), unit(1), 0.1), "dog")
    db.save_embedding(lost, "https://x/l.jpg", unit(0), "dog")

    res = db.find_similar_photos(unit(0), match_threshold=0.9, search_types=["found"])
    assert [r["post_id"] for r in res] == [found]
    assert res[0]["similarity"] > 0.9

    none = db.find_similar_photos(unit(5), match_threshold=0.9, search_types=["found"])
    assert none == []


def test_match_never_crosses_species(db, make_post):
    cat_post = make_post("found")
    unknown_post = make_post("found")
    db.save_embedding(cat_post, "https://x/cat.jpg", unit(0), "cat")
    db.save_embedding(unknown_post, "https://x/unk.jpg", unit(0), None)

    res = db.find_similar_photos(unit(0), match_threshold=0.5, search_types=["found"], query_species="dog")
    assert [r["post_id"] for r in res] == [unknown_post]

    res_cat = db.find_similar_photos(unit(0), match_threshold=0.5, search_types=["found"], query_species="cat")
    assert {r["post_id"] for r in res_cat} == {cat_post, unknown_post}


def test_match_radius_and_distance(db, make_post):
    near = make_post("found", lat=-23.55, lng=-46.63)
    far = make_post("found", lat=-22.90, lng=-43.17)  # Rio de Janeiro
    db.save_embedding(near, "https://x/n.jpg", unit(0), "dog")
    db.save_embedding(far, "https://x/f.jpg", unit(0), "dog")

    res = db.find_similar_photos(unit(0), match_threshold=0.5, lat=-23.551, lng=-46.631,
                                 radius_km=15, search_types=["found"])
    assert [r["post_id"] for r in res] == [near]
    assert 0 <= res[0]["distance_km"] < 1


def test_resolved_posts_are_ignored(db, make_post):
    pid = make_post("found", status="resolved")
    db.save_embedding(pid, "https://x/r.jpg", unit(0), "dog")
    assert db.find_similar_photos(unit(0), match_threshold=0.5, search_types=["found"]) == []


def test_post_details_and_pending(db, make_post):
    pid = make_post("lost")
    details = db.get_post_details([pid])
    assert details[0]["id"] == pid
    assert isinstance(details[0]["pin_lat"], float)
    assert db.get_post_details([]) == []

    with db.get_pool().connection() as conn:
        conn.execute("UPDATE posts SET photos = ARRAY['https://x/p.jpg'] WHERE id = %s", (pid,))
    assert [p["id"] for p in db.get_posts_without_embeddings()] == [pid]
    db.save_embedding(pid, "https://x/p.jpg", unit(0))
    assert db.get_posts_without_embeddings() == []

    db.delete_embeddings(pid)
    assert db.get_embeddings_for_post(pid) == []
```

Run: `cd ai-service && venv/Scripts/python -m pytest tests/test_database.py -v`
Expected: FAIL (`ImportError: cannot import name 'create_client'` ou `AttributeError: close_pool`).

- [ ] **Step 5: Reescrever `database.py`**

```python
"""
Operações de banco de dados para embeddings de fotos.
Conecta direto no Neon (PostgreSQL + pgvector + PostGIS) via psycopg.
"""

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from config import DATABASE_URL

_pool: ConnectionPool | None = None

# Colunas do post devolvidas junto com os matches (sem a coluna geography crua)
POST_COLUMNS = """
    p.id::text AS id, p.user_id, p.type, p.status, p.urgency, p.title, p.description,
    p.species, p.size, p.color_tags, p.event_datetime, p.pin_lat, p.pin_lng,
    p.city, p.neighborhood, p.photos, p.contact_whatsapp, p.contact_phone,
    p.created_at, p.updated_at
"""


def get_pool() -> ConnectionPool:
    """Pool de conexões criado sob demanda (lê DATABASE_URL na primeira chamada)."""
    global _pool
    if _pool is None:
        if not DATABASE_URL:
            raise ValueError("❌ DATABASE_URL deve estar configurado no .env")
        _pool = ConnectionPool(
            DATABASE_URL, min_size=1, max_size=5,
            kwargs={"row_factory": dict_row}, open=True,
        )
    return _pool


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


def _vec(embedding: list[float]) -> str:
    """Literal pgvector: '[0.1,0.2,...]'."""
    return "[" + ",".join(f"{x:.7f}" for x in embedding) + "]"


def save_embedding(post_id: str, photo_url: str, embedding: list[float], species: str | None = None) -> dict:
    """Salva o embedding de uma foto. species: 'dog' | 'cat' | None."""
    with get_pool().connection() as conn:
        row = conn.execute(
            """INSERT INTO photo_embeddings (post_id, photo_url, embedding, species)
               VALUES (%s::uuid, %s, %s::vector, %s)
               RETURNING id::text AS id, post_id::text AS post_id, photo_url, species""",
            (post_id, photo_url, _vec(embedding), species),
        ).fetchone()
    return row or {}


def find_similar_photos(
    query_embedding: list[float],
    match_threshold: float = 0.60,
    match_count: int = 10,
    lat: float | None = None,
    lng: float | None = None,
    radius_km: float | None = None,
    search_types: list[str] | None = None,
    exclude_post_id: str | None = None,
    query_species: str | None = None,
) -> list[dict]:
    """Busca fotos parecidas (pgvector) com filtro de tipo, distância e espécie."""
    with get_pool().connection() as conn:
        rows = conn.execute(
            """SELECT id::text AS id, post_id::text AS post_id, photo_url, species, similarity, distance_km
               FROM match_photos(%s::vector, %s::float8, %s::int, %s::float8, %s::float8,
                                 %s::float8, %s::text[], %s::uuid, %s::text)""",
            (
                _vec(query_embedding), match_threshold, match_count, lat, lng, radius_km,
                search_types or ["lost", "help_request"], exclude_post_id, query_species,
            ),
        ).fetchall()
    return rows


def get_embeddings_for_post(post_id: str) -> list[dict]:
    """Embeddings já salvos de um post (evita reprocessar a foto)."""
    with get_pool().connection() as conn:
        return conn.execute(
            """SELECT id::text AS id, photo_url, embedding::text AS embedding, species
               FROM photo_embeddings WHERE post_id = %s::uuid""",
            (post_id,),
        ).fetchall()


def get_post_details(post_ids: list[str]) -> list[dict]:
    """Detalhes dos posts pelo ID."""
    if not post_ids:
        return []
    with get_pool().connection() as conn:
        return conn.execute(
            f"SELECT {POST_COLUMNS} FROM posts p WHERE p.id = ANY(%s::uuid[])",
            (post_ids,),
        ).fetchall()


def delete_embeddings(post_id: str) -> None:
    """Remove todos os embeddings de um post."""
    with get_pool().connection() as conn:
        conn.execute("DELETE FROM photo_embeddings WHERE post_id = %s::uuid", (post_id,))


def get_posts_without_embeddings() -> list[dict]:
    """Posts ativos com fotos e sem nenhum embedding (para /embeddings/batch)."""
    with get_pool().connection() as conn:
        return conn.execute(
            """SELECT p.id::text AS id, p.photos
               FROM posts p
               WHERE p.status = 'active'
                 AND cardinality(p.photos) > 0
                 AND NOT EXISTS (SELECT 1 FROM photo_embeddings pe WHERE pe.post_id = p.id)"""
        ).fetchall()
```

- [ ] **Step 6: Rodar os testes**

Run: `cd ai-service && venv/Scripts/python -m pytest tests/test_database.py -v`
Expected: 6 passed.

- [ ] **Step 7: Commit**

```bash
git add ai-service/config.py ai-service/database.py ai-service/requirements.txt ai-service/requirements-dev.txt ai-service/.env.example ai-service/pytest.ini ai-service/tests
git commit -m "feat(ai): ai-service acessa o Neon via psycopg, com filtro por espécie"
```

---

### Task 3: Reconhecimento — `/analyze`, espécie salva e match por espécie

**Files:**
- Modify: `ai-service/detector.py`, `ai-service/pipeline.py`, `ai-service/main.py`
- Create: `ai-service/tests/test_detector.py`, `ai-service/tests/test_api.py`

**Interfaces:**
- Consumes: funções da Task 2.
- Produces:
  - `detector.detect(image) -> Detection | None`, `Detection = NamedTuple(species: str, confidence: float, box: tuple[float, float, float, float])`
  - `process_image(image) -> {"embedding", "species", "confidence", "cropped"}`
  - `POST /analyze` (multipart: `file` **ou** `photo_url`) → `{"has_animal": bool, "species": "dog"|"cat"|None, "confidence": float|None}` — usado pela Task 7.
  - `EmbeddingResponse` inalterado (já tem `species_detected`).

- [ ] **Step 1: Testes que falham**

`ai-service/tests/test_detector.py`:

```python
from pathlib import Path

import pytest
from PIL import Image

IMAGES = Path(__file__).resolve().parent.parent / "test_images"


def test_blank_image_has_no_animal():
    from detector import detector
    assert detector.detect(Image.new("RGB", (640, 480), (120, 160, 90))) is None


def test_dog_photo_is_detected_as_dog():
    from detector import detector
    det = detector.detect(Image.open(IMAGES / "labrador_1.jpg"))
    assert det is not None
    assert det.species == "dog"
    assert 0 < det.confidence <= 1


@pytest.mark.skipif(not (IMAGES / "cat_1.jpg").exists(), reason="adicione test_images/cat_1.jpg")
def test_cat_photo_is_detected_as_cat():
    from detector import detector
    det = detector.detect(Image.open(IMAGES / "cat_1.jpg"))
    assert det is not None and det.species == "cat"


def test_process_image_reports_species_and_crop():
    from pipeline import process_image
    res = process_image((IMAGES / "labrador_1.jpg").read_bytes())
    assert res["species"] == "dog" and res["cropped"] is True
    assert len(res["embedding"]) == 384
    blank = process_image(Image.new("RGB", (320, 240), (0, 0, 0)))
    assert blank["species"] is None and blank["cropped"] is False and blank["confidence"] is None
```

`ai-service/tests/test_api.py`:

```python
from io import BytesIO
from pathlib import Path

from fastapi.testclient import TestClient
from PIL import Image

IMAGES = Path(__file__).resolve().parent.parent / "test_images"


def client():
    from main import app
    return TestClient(app)


def test_analyze_dog_upload():
    with open(IMAGES / "labrador_1.jpg", "rb") as f:
        r = client().post("/analyze", files={"file": ("dog.jpg", f, "image/jpeg")})
    assert r.status_code == 200
    body = r.json()
    assert body["has_animal"] is True and body["species"] == "dog"


def test_analyze_photo_without_animal():
    buf = BytesIO()
    Image.new("RGB", (400, 300), (200, 200, 255)).save(buf, "JPEG")
    r = client().post("/analyze", files={"file": ("sky.jpg", buf.getvalue(), "image/jpeg")})
    assert r.status_code == 200
    assert r.json() == {"has_animal": False, "species": None, "confidence": None}


def test_analyze_requires_file_or_url():
    r = client().post("/analyze", data={})
    assert r.status_code == 400


def test_analyze_rejects_non_image():
    r = client().post("/analyze", files={"file": ("x.txt", b"nao sou imagem", "text/plain")})
    assert r.status_code == 400
```

Run: `cd ai-service && venv/Scripts/python -m pytest tests/test_detector.py tests/test_api.py -v`
Expected: FAIL (`AttributeError: 'AnimalDetector' object has no attribute 'detect'`, `/analyze` 404).

- [ ] **Step 2: `detector.py` — separar detecção do recorte**

Adicionar após os imports:

```python
from typing import NamedTuple


class Detection(NamedTuple):
    species: str                                   # 'dog' | 'cat'
    confidence: float                              # 0–1 (YOLO)
    box: tuple[float, float, float, float]         # x1, y1, x2, y2
```

Substituir `detect_and_crop` por estes dois métodos:

```python
    def detect(self, image: Union[Image.Image, bytes]) -> Optional[Detection]:
        """Acha o animal principal (cachorro/gato) na imagem, ou None."""
        image = _to_rgb(image)
        results = self.model.predict(image, conf=YOLO_CONF_THRESHOLD, verbose=False)

        best: Optional[Detection] = None
        best_score = 0.0
        for result in results:
            for box in result.boxes:
                cls = int(box.cls[0])
                if cls not in ANIMAL_CLASSES:
                    continue
                conf = float(box.conf[0])
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                area = (x2 - x1) * (y2 - y1)
                # Score = confiança * área relativa (prioriza o animal principal)
                score = conf * (area / (image.width * image.height))
                if score > best_score:
                    best_score = score
                    best = Detection("cat" if cls == COCO_CAT else "dog", conf, (x1, y1, x2, y2))
        return best

    def detect_and_crop(
        self, image: Union[Image.Image, bytes]
    ) -> tuple[Image.Image, Optional[Detection]]:
        """
        Detecta o animal e retorna (recorte, detecção).
        Sem animal: (imagem original, None) — fallback seguro.
        """
        image = _to_rgb(image)
        det = self.detect(image)
        if det is None:
            return image, None

        # Adiciona padding ao redor do box (contexto ajuda um pouco)
        x1, y1, x2, y2 = det.box
        pad_x = (x2 - x1) * CROP_PADDING
        pad_y = (y2 - y1) * CROP_PADDING
        x1 = max(0, x1 - pad_x)
        y1 = max(0, y1 - pad_y)
        x2 = min(image.width, x2 + pad_x)
        y2 = min(image.height, y2 + pad_y)
        return image.crop((int(x1), int(y1), int(x2), int(y2))), det
```

E a função auxiliar no nível do módulo (antes da classe):

```python
def _to_rgb(image: Union[Image.Image, bytes]) -> Image.Image:
    if isinstance(image, bytes):
        image = Image.open(BytesIO(image))
    return image if image.mode == "RGB" else image.convert("RGB")
```

- [ ] **Step 3: `pipeline.py`**

Substituir o corpo de `process_image` (docstring inclusa):

```python
def process_image(image: Union[Image.Image, bytes]) -> dict:
    """
    Processa uma foto: recorta o animal e gera o embedding.

    Returns:
        {
          "embedding": list[float],     # 384 dims, normalizado
          "species": "dog"|"cat"|None,  # espécie detectada
          "confidence": float|None,     # confiança da detecção
          "cropped": bool,              # se o recorte foi aplicado
        }
    """
    if isinstance(image, bytes):
        image = Image.open(BytesIO(image))

    cropped_image, det = detector.detect_and_crop(image)
    embedding = dino_embedder.generate_embedding(cropped_image)

    return {
        "embedding": embedding,
        "species": det.species if det else None,
        "confidence": round(det.confidence, 4) if det else None,
        "cropped": det is not None,
    }
```

- [ ] **Step 4: `main.py`**

4a. Imports: `from PIL import Image, UnidentifiedImageError` e `from io import BytesIO`; `from detector import detector`.

4b. Novo modelo e helper, logo após `EmbeddingResponse`:

```python
class AnalyzeResponse(BaseModel):
    has_animal: bool
    species: Optional[str] = None
    confidence: Optional[float] = None


async def _download(photo_url: str) -> bytes:
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(photo_url)
    if response.status_code != 200:
        raise HTTPException(
            status_code=400,
            detail=f"Não foi possível baixar a imagem: HTTP {response.status_code}",
        )
    return response.content
```

4c. Endpoint (depois de `/health`):

```python
@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze_photo(
    file: Optional[UploadFile] = File(None),
    photo_url: Optional[str] = Form(None),
):
    """Só detecta: tem cachorro/gato na foto? Usado no formulário antes de salvar."""
    if file is None and not photo_url:
        raise HTTPException(status_code=400, detail="Envie 'file' ou 'photo_url'")
    image_bytes = await file.read() if file is not None else await _download(photo_url)
    try:
        image = Image.open(BytesIO(image_bytes))
        image.load()
    except (UnidentifiedImageError, OSError):
        raise HTTPException(status_code=400, detail="Arquivo não é uma imagem válida")
    det = detector.detect(image)
    if det is None:
        return AnalyzeResponse(has_animal=False)
    return AnalyzeResponse(has_animal=True, species=det.species, confidence=round(det.confidence, 4))
```

4d. `_process_and_save`: salvar a espécie:

```python
    saved = save_embedding(post_id, photo_url, result["embedding"], result["species"])
```

4e. `generate_embedding_from_url`: trocar o bloco `async with httpx.AsyncClient()...` por `image_bytes = await _download(photo_url)`. Docstring: "Gera embedding a partir de uma URL de foto (Vercel Blob)." Docstring de `generate_embedding`: "... e salva no banco."

4f. `/match` (upload): passar a espécie da foto consultada:

```python
        matches = find_similar_photos(
            query_embedding=query_embedding,
            match_threshold=threshold,
            match_count=max_results,
            lat=lat,
            lng=lng,
            radius_km=radius_km if (lat is not None and lng is not None) else None,
            search_types=types,
            query_species=result["species"],
        )
```

4g. `/match/by-post`: dentro do loop `for emb_row in embeddings:`, passar `query_species=emb_row.get("species"),` na chamada de `find_similar_photos`. Remover o `import json` local e usar `json.loads` com `import json` no topo do arquivo.

4h. `/embeddings/batch`: `save_embedding(post_id, photo_url, result["embedding"], result["species"])`.

- [ ] **Step 5: Rodar todos os testes do ai-service**

Run: `cd ai-service && venv/Scripts/python -m pytest -v`
Expected: todos passam (`test_cat_photo_is_detected_as_cat` pode aparecer como SKIPPED se não houver `cat_1.jpg`).

- [ ] **Step 6: Smoke manual**

```bash
cd ai-service && venv/Scripts/python main.py   # outro terminal
curl -s -F "file=@test_images/samoyed_1.jpg" http://localhost:8000/analyze
```
Expected: `{"has_animal":true,"species":"dog","confidence":0.xx}`.

- [ ] **Step 7: Commit**

```bash
git add ai-service/detector.py ai-service/pipeline.py ai-service/main.py ai-service/tests
git commit -m "feat(ai): /analyze, espécie salva no embedding e match sem misturar cão e gato"
```

---

### Task 4: Calibração do limiar de semelhança (DINOv2)

**Files:**
- Create: `ai-service/calibrate.py`
- Modify: `ai-service/config.py` (só se a calibração indicar)

**Interfaces:**
- Consumes: `pipeline.process_image`.
- Produces: número recomendado para `DEFAULT_MATCH_THRESHOLD`.

Convenção de arquivos em `ai-service/test_images/`: `<individuo>_<n>.jpg` — mesmo prefixo = mesmo animal (`labrador_1.jpg` e `labrador_2.jpg` são o mesmo cachorro). **Confirmar com o usuário** que os pares atuais são o mesmo indivíduo antes de confiar no resultado; se não forem, pedir fotos reais (2–3 fotos de 3+ animais diferentes, incluindo o cachorro dele).

- [ ] **Step 1: Escrever o script**

```python
"""
Calibra o limiar de similaridade com fotos reais.

Coloque em test_images/ fotos nomeadas <individuo>_<n>.jpg
(mesmo prefixo = mesmo animal) e rode:  python calibrate.py
"""

from itertools import combinations
from pathlib import Path

from pipeline import compute_similarity, process_image

IMAGES = Path(__file__).parent / "test_images"


def main() -> None:
    files = sorted(p for p in IMAGES.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"})
    data = {}
    for f in files:
        res = process_image(f.read_bytes())
        data[f.name] = (f.stem.rsplit("_", 1)[0], res)
        print(f"{f.name:28} espécie={res['species']} recorte={res['cropped']}")

    same, diff = [], []
    for (a, (ia, ra)), (b, (ib, rb)) in combinations(data.items(), 2):
        s = compute_similarity(ra["embedding"], rb["embedding"])
        (same if ia == ib else diff).append(s)
        print(f"{'MESMO' if ia == ib else 'outro':5}  {s:.4f}  {a} × {b}")

    if not same or not diff:
        print("\n⚠️ Precisa de pelo menos um par do mesmo animal e um par de animais diferentes.")
        return
    lo_same, hi_diff = min(same), max(diff)
    print(f"\nMesmo animal:  min {lo_same:.4f}  média {sum(same)/len(same):.4f}")
    print(f"Animais difer.: máx {hi_diff:.4f}  média {sum(diff)/len(diff):.4f}")
    if lo_same > hi_diff:
        print(f"✅ Separação limpa. Limiar sugerido: {(lo_same + hi_diff) / 2:.2f}")
    else:
        print(f"⚠️ Sobreposição. Limiar que não perde nenhum match verdadeiro: {lo_same - 0.01:.2f}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Rodar**

Run: `cd ai-service && venv/Scripts/python calibrate.py`
Expected: tabela de pares e uma linha de limiar sugerido.

- [ ] **Step 3: Ajustar `DEFAULT_MATCH_THRESHOLD`** em `config.py` para o valor sugerido **somente** se o usuário confirmar que as fotos são pares reais; registrar no commit os números (min mesmo / máx diferente). Caso contrário manter `0.60`.

- [ ] **Step 4: Commit**

```bash
git add ai-service/calibrate.py ai-service/config.py
git commit -m "feat(ai): script de calibração do limiar de semelhança"
```

---

### Task 5: Camada de dados no Next + Vitest

**Files:**
- Create: `lib/db.ts`, `lib/data/validation.ts`, `lib/data/posts.ts`, `lib/data/validation.test.ts`, `lib/data/posts.test.ts`, `vitest.config.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: schema da Task 1.
- Produces (usado nas Tasks 6 e 8):
  - `validateNewPost(body: unknown): { ok: true; value: NewPostInput } | { ok: false; error: string }`
  - `validateNewSighting(body: unknown): { ok: true; value: NewSightingInput } | { ok: false; error: string }`
  - `isUuid(id: string): boolean`
  - `listPosts(q: ListPostsQuery): Promise<{ posts: Post[]; total: number }>`
  - `getPost(id: string): Promise<Post | null>`
  - `createPost(input: NewPostInput, userId: string | null): Promise<Post>`
  - `updatePostStatus(id: string, status: PostStatus): Promise<Post | null>`
  - `getSightings(postId: string): Promise<Sighting[]>`
  - `createSighting(postId: string, input: NewSightingInput, userId: string | null): Promise<Sighting | null>` (null = post não existe)

- [ ] **Step 1: Dependências e config**

```bash
npm install @neondatabase/serverless
npm install -D vitest
```

`package.json` → `scripts`: `"test": "vitest run"`.

`vitest.config.ts`:

```ts
import path from 'node:path';
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

// Testes rodam contra o branch Neon "test" (TEST_DATABASE_URL)
const env = loadEnv('test', process.cwd(), '');

export default defineConfig({
    resolve: { alias: { '@': path.resolve(__dirname) } },
    test: {
        environment: 'node',
        env: { ...env, DATABASE_URL: env.TEST_DATABASE_URL ?? '' },
        fileParallelism: false,
    },
});
```

- [ ] **Step 2: Testes de validação (falham)**

`lib/data/validation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isUuid, validateNewPost, validateNewSighting } from './validation';

const base = { type: 'lost', title: 'Luna', species: 'Cachorro', pin_lat: -23.55, pin_lng: -46.63 };

describe('validateNewPost', () => {
    it('aceita o mínimo e aplica padrões', () => {
        const r = validateNewPost(base);
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.value.urgency).toBe('normal');
            expect(r.value.photos).toEqual([]);
            expect(r.value.color_tags).toEqual([]);
        }
    });
    it.each(['type', 'title', 'species', 'pin_lat', 'pin_lng'])('exige %s', (field) => {
        const r = validateNewPost({ ...base, [field]: undefined });
        expect(r).toEqual({ ok: false, error: `Campo obrigatório: ${field}` });
    });
    it('rejeita tipo desconhecido', () => {
        expect(validateNewPost({ ...base, type: 'sold' }).ok).toBe(false);
    });
    it('rejeita coordenadas fora do intervalo ou não numéricas', () => {
        expect(validateNewPost({ ...base, pin_lat: 200 })).toEqual({ ok: false, error: 'Localização inválida' });
        expect(validateNewPost({ ...base, pin_lng: 'abc' })).toEqual({ ok: false, error: 'Localização inválida' });
    });
    it('aceita latitude 0 (não confunde com ausente)', () => {
        expect(validateNewPost({ ...base, pin_lat: 0, pin_lng: 0 }).ok).toBe(true);
    });
    it('só aceita fotos https', () => {
        expect(validateNewPost({ ...base, photos: ['blob:http://x/1'] })).toEqual({ ok: false, error: 'Foto inválida' });
        expect(validateNewPost({ ...base, photos: ['https://x.public.blob.vercel-storage.com/a.jpg'] }).ok).toBe(true);
    });
});

describe('validateNewSighting', () => {
    it('exige lat, lng e nota', () => {
        expect(validateNewSighting({ lat: -23.5, lng: -46.6 })).toEqual({ ok: false, error: 'Campo obrigatório: note' });
        expect(validateNewSighting({ lat: -23.5, lng: -46.6, note: 'vi na praça' }).ok).toBe(true);
    });
});

describe('isUuid', () => {
    it('reconhece uuid', () => {
        expect(isUuid('1')).toBe(false);
        expect(isUuid('3f2b8c1e-9d4a-4b7e-8f00-0123456789ab')).toBe(true);
    });
});
```

Run: `npx vitest run lib/data/validation.test.ts` → FAIL (módulo não existe).

- [ ] **Step 3: `lib/data/validation.ts`**

```ts
import type { PostType, PostUrgency } from '@/types';

export interface NewPostInput {
    type: PostType;
    urgency: PostUrgency;
    title: string;
    description: string;
    species: string;
    size: string;
    color_tags: string[];
    event_datetime: string | null;
    pin_lat: number;
    pin_lng: number;
    base_lat: number | null;
    base_lng: number | null;
    search_radius_km: number | null;
    city: string;
    neighborhood: string;
    photos: string[];
    contact_whatsapp: string;
    contact_phone: string;
}

export interface NewSightingInput {
    lat: number;
    lng: number;
    datetime: string;
    note: string;
    photo_url: string | null;
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const POST_TYPES: PostType[] = ['lost', 'found', 'help_request'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(id: string): boolean {
    return UUID_RE.test(id);
}

function missing(v: unknown): boolean {
    return v === undefined || v === null || v === '';
}

function toNum(v: unknown): number | null {
    const n = typeof v === 'string' ? Number(v) : v;
    return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

function validLatLng(lat: number | null, lng: number | null): boolean {
    return lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function str(v: unknown): string {
    return typeof v === 'string' ? v.trim() : '';
}

export function validateNewPost(body: unknown): Result<NewPostInput> {
    const b = (body ?? {}) as Record<string, unknown>;
    for (const field of ['type', 'title', 'species', 'pin_lat', 'pin_lng']) {
        if (missing(b[field])) return { ok: false, error: `Campo obrigatório: ${field}` };
    }
    if (!POST_TYPES.includes(b.type as PostType)) return { ok: false, error: 'Tipo de post inválido' };

    const lat = toNum(b.pin_lat);
    const lng = toNum(b.pin_lng);
    if (!validLatLng(lat, lng)) return { ok: false, error: 'Localização inválida' };

    const photos = Array.isArray(b.photos) ? b.photos : [];
    if (!photos.every(p => typeof p === 'string' && p.startsWith('https://'))) {
        return { ok: false, error: 'Foto inválida' };
    }

    const baseLat = toNum(b.base_lat);
    const baseLng = toNum(b.base_lng);
    const hasBase = validLatLng(baseLat, baseLng);

    return {
        ok: true,
        value: {
            type: b.type as PostType,
            urgency: b.urgency === 'urgent' ? 'urgent' : 'normal',
            title: str(b.title),
            description: str(b.description),
            species: str(b.species),
            size: str(b.size),
            color_tags: Array.isArray(b.color_tags) ? b.color_tags.filter((t): t is string => typeof t === 'string') : [],
            event_datetime: str(b.event_datetime) || null,
            pin_lat: lat!,
            pin_lng: lng!,
            base_lat: hasBase ? baseLat : null,
            base_lng: hasBase ? baseLng : null,
            search_radius_km: toNum(b.search_radius_km),
            city: str(b.city),
            neighborhood: str(b.neighborhood),
            photos: photos as string[],
            contact_whatsapp: str(b.contact_whatsapp),
            contact_phone: str(b.contact_phone),
        },
    };
}

export function validateNewSighting(body: unknown): Result<NewSightingInput> {
    const b = (body ?? {}) as Record<string, unknown>;
    for (const field of ['lat', 'lng', 'note']) {
        if (missing(b[field])) return { ok: false, error: `Campo obrigatório: ${field}` };
    }
    const lat = toNum(b.lat);
    const lng = toNum(b.lng);
    if (!validLatLng(lat, lng)) return { ok: false, error: 'Localização inválida' };
    const photo = str(b.photo_url);
    if (photo && !photo.startsWith('https://')) return { ok: false, error: 'Foto inválida' };
    return {
        ok: true,
        value: { lat: lat!, lng: lng!, datetime: str(b.datetime) || new Date().toISOString(), note: str(b.note), photo_url: photo || null },
    };
}
```

Run: `npx vitest run lib/data/validation.test.ts` → PASS.

- [ ] **Step 4: Testes de posts (falham)**

`lib/data/posts.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { sql } from '@/lib/db';
import { createPost, createSighting, getPost, getSightings, listPosts, updatePostStatus } from './posts';
import { validateNewPost, validateNewSighting } from './validation';

function input(over: Record<string, unknown> = {}) {
    const r = validateNewPost({ type: 'lost', title: 'Luna', species: 'Cachorro', pin_lat: -23.55, pin_lng: -46.63, ...over });
    if (!r.ok) throw new Error(r.error);
    return r.value;
}

beforeEach(async () => {
    await sql().query('TRUNCATE posts CASCADE');
});

describe('posts', () => {
    it('cria e lê com tipos certos', async () => {
        const created = await createPost(input({ photos: ['https://x/a.jpg'], color_tags: ['dourado'] }), null);
        const post = await getPost(created.id);
        expect(post).not.toBeNull();
        expect(post!.pin_lat).toBeCloseTo(-23.55, 5);
        expect(typeof post!.pin_lng).toBe('number');
        expect(post!.photos).toEqual(['https://x/a.jpg']);
        expect(post!.color_tags).toEqual(['dourado']);
        expect(post!.status).toBe('active');
        expect(typeof post!.created_at).toBe('string');
        expect(post!.sighting_count).toBe(0);
    });

    it('getPost com id inválido ou inexistente devolve null', async () => {
        expect(await getPost('1')).toBeNull();
        expect(await getPost('3f2b8c1e-9d4a-4b7e-8f00-0123456789ab')).toBeNull();
    });

    it('filtra por tipo e espécie (sem diferenciar maiúsculas)', async () => {
        await createPost(input({ type: 'lost', species: 'Cachorro' }), null);
        await createPost(input({ type: 'found', species: 'Gato' }), null);
        const { posts, total } = await listPosts({ type: 'found', species: 'gato' });
        expect(total).toBe(1);
        expect(posts[0].species).toBe('Gato');
    });

    it('bbox e raio', async () => {
        await createPost(input({ title: 'SP', pin_lat: -23.55, pin_lng: -46.63 }), null);
        await createPost(input({ title: 'Rio', pin_lat: -22.90, pin_lng: -43.17 }), null);

        const bbox = await listPosts({ bbox: { sw_lat: -24, sw_lng: -47, ne_lat: -23, ne_lng: -46 } });
        expect(bbox.posts.map(p => p.title)).toEqual(['SP']);

        const near = await listPosts({ near: { lat: -23.56, lng: -46.64, radius_km: 500 } });
        expect(near.posts.map(p => p.title)).toEqual(['SP', 'Rio']);
        expect(near.posts[0].distance_km!).toBeLessThan(2);
        expect(near.posts[1].distance_km!).toBeGreaterThan(300);
    });

    it('não lista resolvidos por padrão', async () => {
        const p = await createPost(input(), null);
        await updatePostStatus(p.id, 'resolved');
        expect((await listPosts({})).total).toBe(0);
        expect((await listPosts({ status: 'resolved' })).total).toBe(1);
    });

    it('avistamentos', async () => {
        const p = await createPost(input(), null);
        const s = validateNewSighting({ lat: -23.551, lng: -46.631, note: 'vi na praça' });
        if (!s.ok) throw new Error(s.error);
        const created = await createSighting(p.id, s.value, null);
        expect(created!.lat).toBeCloseTo(-23.551, 5);
        expect((await getSightings(p.id)).length).toBe(1);
        expect((await getPost(p.id))!.sighting_count).toBe(1);
        expect(await createSighting('3f2b8c1e-9d4a-4b7e-8f00-0123456789ab', s.value, null)).toBeNull();
    });
});
```

Run: `npx vitest run lib/data/posts.test.ts` → FAIL (módulos não existem).

- [ ] **Step 5: `lib/db.ts`**

```ts
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

let client: NeonQueryFunction<false, false> | null = null;

// Cliente Neon (HTTP) criado sob demanda — lê DATABASE_URL na primeira chamada.
export function sql(): NeonQueryFunction<false, false> {
    if (!client) {
        const url = process.env.DATABASE_URL;
        if (!url) throw new Error('DATABASE_URL não configurada');
        client = neon(url);
    }
    return client;
}
```

- [ ] **Step 6: `lib/data/posts.ts`**

```ts
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
```

Adicione também este teste ao `posts.test.ts` (base de pedido de ajuda):

```ts
    it('guarda base_location de pedido de ajuda', async () => {
        const p = await createPost(input({ type: 'help_request', base_lat: -23.54, base_lng: -46.64, search_radius_km: 3 }), null);
        expect(p.base_lat).toBeCloseTo(-23.54, 5);
        expect(p.search_radius_km).toBe(3);
    });
```

- [ ] **Step 7: Rodar**

Run: `npm test`
Expected: todos os testes de `validation` e `posts` passam.

- [ ] **Step 8: Commit**

```bash
git add lib/db.ts lib/data vitest.config.ts package.json package-lock.json
git commit -m "feat(data): camada de dados no Neon com testes de integração"
```

---

### Task 6: Rotas da API e seed usando o banco

**Files:**
- Modify: `app/api/posts/route.ts`, `app/api/posts/[id]/route.ts`, `app/api/posts/[id]/sightings/route.ts`, `package.json`
- Create: `scripts/seed.mjs`, `lib/ai.ts`

**Interfaces:**
- Consumes: Task 5.
- Produces: `triggerEmbeddings(postId: string, photos: string[]): void` em `lib/ai.ts`; respostas das rotas **no mesmo formato de hoje** (GeoJSON em `GET /api/posts`, `Post` em `GET /api/posts/[id]`, `{ sightings, total }`).

- [ ] **Step 1: `lib/ai.ts`**

```ts
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
```

- [ ] **Step 2: `app/api/posts/route.ts`** (substituir o arquivo)

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createPost, listPosts } from '@/lib/data/posts';
import { validateNewPost } from '@/lib/data/validation';
import { triggerEmbeddings } from '@/lib/ai';
import type { PostStatus, PostType, PostUrgency } from '@/types';

function dbError(err: unknown) {
    console.error('[DB]', err);
    return NextResponse.json({ error: 'Banco de dados indisponível. Tente de novo em instantes.' }, { status: 503 });
}

// GET /api/posts?bbox=sw_lat,sw_lng,ne_lat,ne_lng&type=lost&species=cachorro
// GET /api/posts?near=lat,lng&radius=50&type=lost
export async function GET(request: NextRequest) {
    const sp = new URL(request.url).searchParams;
    const nums = (v: string | null) => (v ? v.split(',').map(Number) : null);
    const bbox = nums(sp.get('bbox'));
    const near = nums(sp.get('near'));
    const page = Math.max(parseInt(sp.get('page') || '1'), 1);
    const limit = parseInt(sp.get('limit') || '20');

    if ((bbox && (bbox.length !== 4 || bbox.some(Number.isNaN))) || (near && (near.length !== 2 || near.some(Number.isNaN)))) {
        return NextResponse.json({ error: 'Parâmetros de localização inválidos' }, { status: 400 });
    }

    try {
        const { posts, total } = await listPosts({
            type: (sp.get('type') as PostType) || undefined,
            species: sp.get('species') || undefined,
            urgency: (sp.get('urgency') as PostUrgency) || undefined,
            status: (sp.get('status') as PostStatus) || 'active',
            bbox: bbox ? { sw_lat: bbox[0], sw_lng: bbox[1], ne_lat: bbox[2], ne_lng: bbox[3] } : undefined,
            near: near ? { lat: near[0], lng: near[1], radius_km: parseFloat(sp.get('radius') || '50') } : undefined,
            limit,
            offset: (page - 1) * limit,
        });
        return NextResponse.json({
            type: 'FeatureCollection',
            features: posts.map(post => ({
                type: 'Feature',
                properties: post,
                geometry: { type: 'Point', coordinates: [post.pin_lng, post.pin_lat] },
            })),
            total,
            page,
            limit,
        });
    } catch (err) {
        return dbError(err);
    }
}

// POST /api/posts
export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => null);
    const parsed = validateNewPost(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    try {
        // Sem login ainda: user_id NULL (o plano do Neon Auth preenche)
        const post = await createPost(parsed.value, null);
        if (post.photos.length > 0) triggerEmbeddings(post.id, post.photos);
        return NextResponse.json(post, { status: 201 });
    } catch (err) {
        return dbError(err);
    }
}
```

- [ ] **Step 3: `app/api/posts/[id]/route.ts`** (substituir)

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getPost, updatePostStatus } from '@/lib/data/posts';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/posts/[id]
export async function GET(_request: NextRequest, { params }: Ctx) {
    const { id } = await params;
    try {
        const post = await getPost(id);
        if (!post) return NextResponse.json({ error: 'Post não encontrado' }, { status: 404 });
        return NextResponse.json(post);
    } catch (err) {
        console.error('[DB]', err);
        return NextResponse.json({ error: 'Banco de dados indisponível' }, { status: 503 });
    }
}

// PATCH /api/posts/[id] — atualiza status (autor será checado no plano de login)
export async function PATCH(request: NextRequest, { params }: Ctx) {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (body?.status !== 'active' && body?.status !== 'resolved') {
        return NextResponse.json({ error: 'Status inválido' }, { status: 400 });
    }
    try {
        const post = await updatePostStatus(id, body.status);
        if (!post) return NextResponse.json({ error: 'Post não encontrado' }, { status: 404 });
        return NextResponse.json(post);
    } catch (err) {
        console.error('[DB]', err);
        return NextResponse.json({ error: 'Erro ao atualizar post' }, { status: 503 });
    }
}
```

- [ ] **Step 4: `app/api/posts/[id]/sightings/route.ts`** (substituir)

Decisão: a foto do avistamento **não** vira embedding do post perdido (hoje o código faz isso, e a foto passaria a contar como se fosse do post `lost`). Avistamento é só registro com local/foto.

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createSighting, getSightings } from '@/lib/data/posts';
import { validateNewSighting } from '@/lib/data/validation';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/posts/[id]/sightings
export async function GET(_request: NextRequest, { params }: Ctx) {
    const { id } = await params;
    try {
        const sightings = await getSightings(id);
        return NextResponse.json({ sightings, total: sightings.length });
    } catch (err) {
        console.error('[DB]', err);
        return NextResponse.json({ error: 'Banco de dados indisponível' }, { status: 503 });
    }
}

// POST /api/posts/[id]/sightings
export async function POST(request: NextRequest, { params }: Ctx) {
    const { id } = await params;
    const parsed = validateNewSighting(await request.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    try {
        const sighting = await createSighting(id, parsed.value, null);
        if (!sighting) return NextResponse.json({ error: 'Post não encontrado' }, { status: 404 });
        return NextResponse.json(sighting, { status: 201 });
    } catch (err) {
        console.error('[DB]', err);
        return NextResponse.json({ error: 'Erro ao criar avistamento' }, { status: 503 });
    }
}
```

- [ ] **Step 5: Seed**

`lib/mock-data.ts` é TypeScript; o seed lê os dados via `tsx`: `npm install -D tsx`. `package.json` → `"db:seed": "tsx scripts/seed.mjs"`.

`scripts/seed.mjs`:

```js
// Insere os posts/avistamentos de lib/mock-data.ts no banco (DATABASE_URL).
// Apaga os posts existentes antes — use só no branch dev.
import pg from 'pg';
import nextEnv from '@next/env';
import { MOCK_POSTS, MOCK_SIGHTINGS } from '../lib/mock-data.ts';

nextEnv.loadEnvConfig(process.cwd());
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
```

- [ ] **Step 6: Verificar**

```bash
npm run db:seed
npm run dev   # outro terminal
curl -s "http://localhost:3000/api/posts?limit=3" | python -c "import sys,json;d=json.load(sys.stdin);print(d['total'], [f['properties']['title'] for f in d['features']])"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/posts/1
curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "Content-Type: application/json" -d '{"type":"lost","title":"x","species":"Gato","pin_lat":200,"pin_lng":0}' http://localhost:3000/api/posts
```
Expected: total > 0 e títulos do mock; `404`; `400`.

- [ ] **Step 7: Commit**

```bash
git add app/api/posts lib/ai.ts scripts/seed.mjs package.json package-lock.json
git commit -m "feat(api): rotas de posts e avistamentos lendo do Neon + seed"
```

---

### Task 7: Upload no Vercel Blob e análise da foto

**Files:**
- Create: `app/api/upload/route.ts`, `app/api/photos/analyze/route.ts`, `app/api/photos/analyze/route.test.ts`, `components/posts/PhotoUploader.tsx`
- Modify: `lib/upload.ts`, `next.config.ts`, `.env.local`

**Interfaces:**
- Consumes: `POST /analyze` do ai-service (Task 3), `AI_SERVICE_URL` de `lib/ai.ts`.
- Produces:
  - `uploadImage(file: File): Promise<string>` (URL pública https do Blob)
  - `POST /api/photos/analyze` JSON `{ photo_url }` → `{ has_animal, species, confidence }` | `503 { error }`
  - `<PhotoUploader photos={string[]} onChange={(urls: string[]) => void} onSpeciesDetected={(s: 'Cachorro' | 'Gato') => void} />`

- [ ] **Step 1: Token do Blob (ação do usuário)**

No painel da Vercel: Storage → Create → Blob → criar store `petfinder-photos` → copiar `BLOB_READ_WRITE_TOKEN` para `.env.local`. Então `npm install @vercel/blob`.

- [ ] **Step 2: Teste da rota de análise (falha)**

`app/api/photos/analyze/route.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

function req(body: unknown) {
    return new Request('http://localhost/api/photos/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    }) as never;
}

afterEach(() => vi.unstubAllGlobals());

describe('POST /api/photos/analyze', () => {
    it('exige photo_url https', async () => {
        expect((await POST(req({}))).status).toBe(400);
        expect((await POST(req({ photo_url: 'blob:http://x' }))).status).toBe(400);
    });

    it('repassa a resposta do ai-service', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => Response.json({ has_animal: true, species: 'cat', confidence: 0.9 })));
        const res = await POST(req({ photo_url: 'https://x/cat.jpg' }));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ has_animal: true, species: 'cat', confidence: 0.9 });
    });

    it('ai-service fora → 503 com mensagem', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
        const res = await POST(req({ photo_url: 'https://x/cat.jpg' }));
        expect(res.status).toBe(503);
        expect((await res.json()).error).toBe('Análise indisponível agora');
    });
});
```

Run: `npx vitest run app/api/photos` → FAIL.

- [ ] **Step 3: `app/api/photos/analyze/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { AI_SERVICE_URL } from '@/lib/ai';

// POST /api/photos/analyze — { photo_url } → tem cachorro/gato na foto?
export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => null);
    const photoUrl = typeof body?.photo_url === 'string' ? body.photo_url : '';
    if (!photoUrl.startsWith('https://')) {
        return NextResponse.json({ error: 'photo_url inválida' }, { status: 400 });
    }

    const form = new FormData();
    form.append('photo_url', photoUrl);
    try {
        const res = await fetch(`${AI_SERVICE_URL}/analyze`, { method: 'POST', body: form });
        if (!res.ok) throw new Error(`ai-service HTTP ${res.status}`);
        return NextResponse.json(await res.json());
    } catch (err) {
        console.warn('[AI] /analyze falhou:', err);
        return NextResponse.json({ error: 'Análise indisponível agora' }, { status: 503 });
    }
}
```

Run: `npx vitest run app/api/photos` → PASS.

- [ ] **Step 4: `app/api/upload/route.ts`**

```ts
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

// Gera o token para o navegador subir a foto direto no Vercel Blob.
// TODO do plano de login: exigir usuário logado em onBeforeGenerateToken.
export async function POST(request: Request) {
    const body = (await request.json()) as HandleUploadBody;
    try {
        const json = await handleUpload({
            body,
            request,
            onBeforeGenerateToken: async () => ({
                allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
                maximumSizeInBytes: 5 * 1024 * 1024,
                addRandomSuffix: true,
            }),
            onUploadCompleted: async () => {
                // Não chamado em localhost; o post é quem registra as URLs.
            },
        });
        return NextResponse.json(json);
    } catch (err) {
        return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
}
```

- [ ] **Step 5: `lib/upload.ts`** — substituir `uploadImage` e remover `revokeImageUrls` se não houver mais usos (`grep -rn revokeImageUrls app components`):

```ts
import { upload } from '@vercel/blob/client';

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
```

(`createThumbnail` fica sem uso → remover junto com `THUMB_OPTIONS`.)

- [ ] **Step 6: `next.config.ts`** — permitir imagens do Blob caso algum componente use `next/image`:

```ts
images: {
    remotePatterns: [{ protocol: 'https', hostname: '*.public.blob.vercel-storage.com' }],
},
```

(Mesclar com o objeto existente em `next.config.ts`.)

- [ ] **Step 7: `components/posts/PhotoUploader.tsx`**

```tsx
'use client';

import { useRef, useState } from 'react';
import { uploadImage } from '@/lib/upload';

type Analysis =
    | { state: 'uploading' }
    | { state: 'analyzing' }
    | { state: 'done'; species: 'dog' | 'cat' | null }
    | { state: 'unavailable' }
    | { state: 'error'; message: string };

interface PhotoUploaderProps {
    photos: string[];
    onChange: (urls: string[]) => void;
    onSpeciesDetected: (species: 'Cachorro' | 'Gato') => void;
}

const MAX_PHOTOS = 5;
const SPECIES_LABEL = { dog: '🐶 Cachorro detectado', cat: '🐱 Gato detectado' } as const;

export default function PhotoUploader({ photos, onChange, onSpeciesDetected }: PhotoUploaderProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [pending, setPending] = useState<{ id: string; preview: string; analysis: Analysis }[]>([]);
    const [analysisByUrl, setAnalysisByUrl] = useState<Record<string, Analysis>>({});

    async function handleFiles(files: FileList | null) {
        if (!files) return;
        const room = MAX_PHOTOS - photos.length - pending.length;
        const selected = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, Math.max(room, 0));
        let urls = [...photos];

        for (const file of selected) {
            const id = crypto.randomUUID();
            const preview = URL.createObjectURL(file);
            setPending(p => [...p, { id, preview, analysis: { state: 'uploading' } }]);
            try {
                const url = await uploadImage(file);
                urls = [...urls, url];
                onChange(urls);
                setAnalysisByUrl(a => ({ ...a, [url]: { state: 'analyzing' } }));
                analyze(url);
            } catch {
                setAnalysisByUrl(a => ({ ...a, [preview]: { state: 'error', message: 'Falha no envio' } }));
            } finally {
                setPending(p => p.filter(x => x.id !== id));
                URL.revokeObjectURL(preview);
            }
        }
    }

    async function analyze(url: string) {
        try {
            const res = await fetch('/api/photos/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ photo_url: url }),
            });
            if (!res.ok) throw new Error();
            const data: { has_animal: boolean; species: 'dog' | 'cat' | null } = await res.json();
            setAnalysisByUrl(a => ({ ...a, [url]: { state: 'done', species: data.has_animal ? data.species : null } }));
            if (data.species) onSpeciesDetected(data.species === 'dog' ? 'Cachorro' : 'Gato');
        } catch {
            setAnalysisByUrl(a => ({ ...a, [url]: { state: 'unavailable' } }));
        }
    }

    function label(a: Analysis | undefined): string {
        if (!a || a.state === 'analyzing') return '🔎 Analisando...';
        if (a.state === 'uploading') return '⬆️ Enviando...';
        if (a.state === 'unavailable') return 'Análise indisponível agora';
        if (a.state === 'error') return a.message;
        return a.species ? SPECIES_LABEL[a.species] : '⚠️ Não encontramos um cachorro ou gato nesta foto';
    }

    return (
        <>
            <div
                className="image-upload-area"
                role="button"
                tabIndex={0}
                onClick={() => inputRef.current?.click()}
                onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            >
                <div style={{ fontSize: '3rem', marginBottom: 'var(--space-sm)' }}>📷</div>
                <p style={{ fontWeight: 600, marginBottom: 'var(--space-xs)' }}>Clique ou arraste fotos aqui</p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    PNG, JPG ou WEBP • até {MAX_PHOTOS} fotos • comprimidas automaticamente
                </p>
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    hidden
                    onChange={e => { handleFiles(e.target.files); e.target.value = ''; }}
                />
            </div>

            {(photos.length > 0 || pending.length > 0) && (
                <div className="image-preview-grid">
                    {photos.map(url => (
                        <div key={url} className="image-preview">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="Foto do pet" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <span className="image-preview-label">{label(analysisByUrl[url])}</span>
                            <button className="remove-btn" onClick={() => onChange(photos.filter(p => p !== url))}>✕</button>
                        </div>
                    ))}
                    {pending.map(p => (
                        <div key={p.id} className="image-preview" style={{ opacity: 0.6 }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.preview} alt="Enviando" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <span className="image-preview-label">{label(p.analysis)}</span>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}
```

Adicionar em `app/globals.css`:

```css
.image-preview-label {
    position: absolute;
    left: 4px;
    right: 4px;
    bottom: 4px;
    padding: 2px 6px;
    border-radius: var(--radius-sm, 6px);
    background: rgba(0, 0, 0, 0.65);
    color: #fff;
    font-size: 0.6875rem;
    line-height: 1.3;
}
```

(Conferir que `.image-preview` já tem `position: relative`; se não tiver, adicionar.)

- [ ] **Step 8: Rodar testes e lint**

Run: `npm test && npm run lint`
Expected: tudo passa.

- [ ] **Step 9: Commit**

```bash
git add app/api/upload app/api/photos components/posts lib/upload.ts next.config.ts app/globals.css package.json package-lock.json
git commit -m "feat(fotos): upload no Vercel Blob e análise de espécie no envio"
```

---

### Task 8: Formulário e páginas com dados reais

**Files:**
- Modify: `app/posts/new/page.tsx`, `app/feed/page.tsx`, `app/map/page.tsx`, `app/posts/[id]/page.tsx`

**Interfaces:**
- Consumes: `PhotoUploader` (Task 7), rotas (Task 6).

- [ ] **Step 1: `app/posts/new/page.tsx`**

1a. Import: `import PhotoUploader from '@/components/posts/PhotoUploader';` e `import { useRouter } from 'next/navigation';`.

1b. Estado: `const router = useRouter(); const [submitting, setSubmitting] = useState(false); const [submitError, setSubmitError] = useState<string | null>(null);`

1c. Substituir `handleSubmit`:

```tsx
    const handleSubmit = async () => {
        setSubmitting(true);
        setSubmitError(null);
        try {
            const res = await fetch('/api/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    base_lat: formData.type === 'help_request' ? formData.pin_lat : undefined,
                    base_lng: formData.type === 'help_request' ? formData.pin_lng : undefined,
                }),
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body.error || 'Erro ao criar post');
            router.push(`/posts/${body.id}`);
        } catch (e) {
            setSubmitError(e instanceof Error ? e.message : 'Erro ao criar post');
            setSubmitting(false);
        }
    };
```

1d. No passo 3 (Fotos), substituir a `div.image-upload-area` e o bloco `formData.photos.length > 0 && (...)` por:

```tsx
                        <PhotoUploader
                            photos={formData.photos}
                            onChange={photos => setFormData(f => ({ ...f, photos }))}
                            onSpeciesDetected={species => setFormData(f => (f.species ? f : { ...f, species }))}
                        />
```

(Espécie só é preenchida automaticamente se o usuário ainda não escolheu. Atualizar o texto: "Adicione fotos do pet. Nós detectamos se é cachorro ou gato e usamos a foto para achar pets parecidos.")

1e. Botão final: `disabled={submitting}`, texto `{submitting ? 'Publicando...' : <texto atual>}`, e abaixo `{submitError && <p style={{ color: 'var(--color-lost)', marginTop: 'var(--space-sm)' }}>{submitError}</p>}`.

- [ ] **Step 2: `app/feed/page.tsx`** — trocar o carregamento mock:

Remover imports de `MOCK_POSTS` e `haversineDistance` (se não usado mais). Substituir o bloco "Load mock data with distances" por:

```tsx
        fetch(`/api/posts?near=${userLat},${userLng}&radius=50&limit=100`)
            .then(res => (res.ok ? res.json() : Promise.reject()))
            .then(data => setPosts(data.features.map((f: { properties: Post }) => f.properties)))
            .catch(() => setPosts([]))
            .finally(() => setLoading(false));
```

- [ ] **Step 3: `app/map/page.tsx`**

```tsx
    const [posts, setPosts] = useState<Post[]>([]);
    useEffect(() => {
        fetch('/api/posts?limit=500')
            .then(res => (res.ok ? res.json() : Promise.reject()))
            .then(data => setPosts(data.features.map((f: { properties: Post }) => f.properties)))
            .catch(() => setPosts([]));
    }, []);
```

Remover o import de `MOCK_POSTS`.

- [ ] **Step 4: `app/posts/[id]/page.tsx`**

Trocar leitura do mock por fetch:

```tsx
    const [post, setPost] = useState<Post | null>(null);
    const [sightings, setSightings] = useState<Sighting[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            fetch(`/api/posts/${postId}`).then(r => (r.ok ? r.json() : null)),
            fetch(`/api/posts/${postId}/sightings`).then(r => (r.ok ? r.json() : { sightings: [] })),
        ])
            .then(([p, s]) => { setPost(p); setSightings(s.sightings); })
            .finally(() => setLoading(false));
    }, [postId]);

    if (loading) {
        return <div className="page-content"><div className="empty-state"><div className="empty-state-icon">⏳</div></div></div>;
    }
```

(O `if (!post)` existente continua depois disso. Importar `useEffect`, `Post`, `Sighting` de `@/types`; remover import do mock. Todos os hooks ficam antes dos `return`s.)

Na galeria, trocar o emoji fixo por foto quando houver:

```tsx
                {post.photos[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.photos[0]} alt={post.title} style={{ width: '100%', height: '300px', objectFit: 'cover', borderRadius: 'var(--radius-lg)' }} />
                ) : (
                    <div style={{ /* estilo atual do placeholder com emoji */ }}>{getSpeciesEmoji(post.species)}</div>
                )}
```

Se o formulário de avistamento da página ainda só guarda estado local, ligá-lo a `POST /api/posts/${postId}/sightings` com `{ lat: post.pin_lat, lng: post.pin_lng, note: sightingNote }` e recarregar a lista no sucesso. (Área provável usará a posição real do avistamento — sub-projeto seguinte.)

- [ ] **Step 5: Verificação ponta a ponta (manual)**

Com `npm run dev` e `ai-service` rodando:
1. `/posts/new` → tipo **Perdido** → fotos: subir `ai-service/test_images/labrador_1.jpg` → aparece "🐶 Cachorro detectado" e espécie vira "Cachorro" → publicar → redireciona para o post e a foto aparece.
2. Criar outro post **Encontrado** perto, com `labrador_2.jpg`.
3. Abrir o post perdido → painel de matches mostra o encontrado com % de semelhança.
4. Criar post **Encontrado** com foto de gato (se disponível) → não aparece no painel do cachorro.
5. Subir uma foto sem animal (paisagem) → aviso "Não encontramos um cachorro ou gato nesta foto", post pode ser publicado.
6. Parar o ai-service e subir uma foto → "Análise indisponível agora"; publicar → 201 e post aparece no feed.
7. `/posts/abc` → tela "Post não encontrado".

Expected: todos os passos se comportam como descrito. Anotar qualquer desvio.

- [ ] **Step 6: Commit**

```bash
git add app/posts app/feed app/map
git commit -m "feat(app): formulário com fotos reais e páginas lendo do banco"
```

---

### Task 9: Remover o Supabase

**Files:**
- Delete: `supabase/`, `lib/supabase/`
- Modify: `package.json`, `.env.local.example`, comentários que citam Supabase

- [ ] **Step 1: Confirmar que nada usa**

Run: `grep -rniE "supabase" --include=*.ts --include=*.tsx --include=*.py --include=*.mjs app components lib scripts ai-service/*.py`
Expected: só ocorrências em `lib/supabase/` (que vai ser apagada) e, eventualmente, comentários — reescrever comentários para "banco"/"Neon"/"Vercel Blob".

- [ ] **Step 2: Apagar e desinstalar**

```bash
git rm -r supabase lib/supabase 2>/dev/null || rm -rf supabase lib/supabase
npm uninstall @supabase/supabase-js
```

- [ ] **Step 3: `.env.local.example`**

```
# Neon Postgres — branch dev (app) e test (npm test / pytest)
DATABASE_URL=postgresql://USER:SENHA@HOST/neondb?sslmode=require
TEST_DATABASE_URL=postgresql://USER:SENHA@HOST/neondb?sslmode=require
NEON_API_KEY=napi_...

# Vercel Blob (fotos)
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...

# AI service (FastAPI)
AI_SERVICE_URL=http://localhost:8000

# Mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=your-mapbox-token
```

- [ ] **Step 4: Verificação final**

Run: `npm test && npm run lint && npm run build && (cd ai-service && venv/Scripts/python -m pytest -q)`
Expected: tudo verde; build sem erros de import.

- [ ] **Step 5: Commit**

```bash
git add -A package.json package-lock.json .env.local.example lib app components
git commit -m "chore: remove Supabase (banco no Neon, fotos no Vercel Blob)"
```
