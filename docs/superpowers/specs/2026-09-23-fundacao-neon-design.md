# Fundação Neon — Design

Data: 2026-09-23
Status: aguardando revisão

## Objetivo

Tirar o app do mock e do Supabase e colocar tudo em cima de **Neon**, deixando pronta a base
para as funções importantes: posts, avistamentos, match por foto, área provável e XP.

Decisões já tomadas:
- **Banco:** Neon, projeto `petfinder` (`withered-rain-42539725`), região `aws-sa-east-1`, Postgres 17,
  extensões `postgis` 3.5.7 e `vector` 0.8.0 já ativas. `DATABASE_URL` em `.env.local`.
- **Login:** Neon Auth (Better Auth gerenciado; dados no schema `neon_auth` do mesmo banco).
- **Fotos:** Vercel Blob.
- **Supabase sai por completo** (pasta `supabase/`, `lib/supabase/`, dependências JS e Python).

### Ordem dos sub-projetos (atualizada)
1. **Fundação Neon** — este spec.
2. **Área provável + modo busca** — `2026-09-23-area-provavel-design.md`, agora lendo do banco real.
3. **XP / gamificação** — regras e UI; a tabela já nasce aqui.

## Estado atual (o que muda)
- Rotas Next (`app/api/posts/**`) e páginas (`feed`, `map`, `posts/[id]`) leem `lib/mock-data.ts`.
- `lib/upload.ts` só cria `blob:` URLs locais — nenhuma foto é enviada.
- `login`/`register` são telas sem backend.
- `ai-service/database.py` usa o cliente Supabase (`table()`, `rpc("match_photos")`).

## Banco

### Migrations
- Nova pasta `db/migrations/` com SQL puro numerado (`0001_...sql`).
- Runner `scripts/migrate.mjs` (driver `@neondatabase/serverless`): cria `schema_migrations`,
  aplica em ordem os arquivos ainda não aplicados, cada um numa transação. `npm run db:migrate`.
- `supabase/migrations/` é apagada; o conteúdo útil é portado.

### Schema (`0001_init.sql`)
Portado de 001–003 do Supabase, com estas mudanças:
- `user_id TEXT` referenciando `neon_auth."user"(id)` (o id do Better Auth é texto)
  `ON DELETE SET NULL`. Se o Neon não permitir FK para o schema gerenciado, fica sem FK e com índice.
- **Sem RLS e sem `auth.uid()`**: o banco só é acessado pelo servidor (Next e ai-service);
  a regra "só o autor edita" vai para as rotas.
- `photo_embeddings.embedding vector(384)` direto (DINOv2), índice HNSW cosine.
- Mantidas: `posts` (com `pin_lat`/`pin_lng` gerados), `sightings`, `alert_preferences`, `reports`,
  `get_posts_in_bbox`, `get_posts_near`, `match_photos`, trigger `updated_at`.
- Novo: `sightings` ganha `pin_lat`/`pin_lng` gerados, igual a `posts`.
- Novo, **base do XP**:
  ```sql
  CREATE TABLE xp_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL,          -- 'street_photo', 'sighting', 'reunion', ...
    points INT NOT NULL,
    ref_id UUID,                 -- post/sighting que gerou o XP
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, kind, ref_id)   -- não ganha duas vezes pelo mesmo item
  );
  CREATE VIEW user_xp AS SELECT user_id, SUM(points)::int AS xp FROM xp_events GROUP BY user_id;
  ```
  As regras de pontuação ficam no sub-projeto 3.

### Seed
`scripts/seed.mjs` (`npm run db:seed`) insere os posts e avistamentos de `lib/mock-data.ts`
com um usuário de demo, para o app não abrir vazio. Depois disso, `lib/mock-data.ts` só é usado pelo seed.

### Branches do Neon
- `main` = banco "de verdade".
- `dev` = branch criado a partir de `main` para desenvolvimento; `.env.local` aponta para ele.

## Acesso a dados no Next

- `lib/db.ts` — cliente `neon(process.env.DATABASE_URL)` (driver serverless, SQL com template tags).
- `lib/data/posts.ts` — `listPosts(filters, bbox|near)`, `getPost(id)`, `createPost(userId, data)`,
  `updatePost(userId, id, patch)` (verifica autor), `getSightings(postId)`, `createSighting(userId, postId, data)`.
  Converte linhas do banco para os tipos de `types/index.ts` (que ganham `user_id: string` sem mudança de formato).
- Rotas `app/api/posts/**` passam a chamar esses helpers. Formato das respostas não muda.
- Páginas `feed`, `map`, `posts/[id]` param de importar o mock e buscam das rotas.

## Login (Neon Auth)

- Ativar Neon Auth no projeto (console ou API) → gera `NEON_AUTH_BASE_URL`; criar `NEON_AUTH_COOKIE_SECRET`.
- `lib/auth.ts` — `createNeonAuth(...)` de `@neondatabase/auth/next/server`.
- Rota handler do auth em `app/api/auth/[...path]/route.ts`.
- `login` e `register` passam a usar o cliente de `@neondatabase/neon-js/auth` (email + senha).
- Helper `requireUser()` para as rotas que escrevem (criar post, avistamento, upload): sem sessão → 401.
- Ler (feed, mapa, detalhe) continua público.
- Navbar mostra "Entrar" ou o usuário logado.

Detalhes exatos da API (nomes de funções de sessão, middleware) serão confirmados na documentação
do Neon Auth na hora de implementar.

## Fotos (Vercel Blob)

- `@vercel/blob`, **upload direto do navegador** (client upload): `app/api/upload/route.ts` usa
  `handleUpload`, exige usuário logado, aceita só `image/jpeg|png|webp` até 5 MB.
- `lib/upload.ts` mantém a compressão e troca o `URL.createObjectURL` pelo `upload()` do Blob;
  devolve URLs públicas.
- Ao criar o post, as URLs vão em `photos`; o Next chama o ai-service
  (`/embeddings/generate-from-url`) para cada foto. Se o ai-service estiver fora, o post é salvo
  mesmo assim e `/embeddings/batch` recupera depois.
- **Ação sua:** criar um Blob store no painel da Vercel e colocar `BLOB_READ_WRITE_TOKEN` no `.env.local`.

## ai-service

- `database.py` reescrito com `psycopg` (pool) + `DATABASE_URL`; mesmas funções públicas,
  mesmo retorno. Embedding enviado como literal `'[...]'::vector`; `match_photos` chamado com SQL.
- `config.py`: sai `SUPABASE_URL/KEY`, entra `DATABASE_URL`.
- `requirements.txt`: sai `supabase`, entra `psycopg[binary,pool]`.
- `.env.example` atualizado.

## Limpeza
- Apagar `supabase/`, `lib/supabase/`, dependência `@supabase/supabase-js`.
- `.env.local.example` com: `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`,
  `BLOB_READ_WRITE_TOKEN`, `AI_SERVICE_URL`, `NEXT_PUBLIC_MAPBOX_TOKEN`.

## Erros
- Banco fora → rotas respondem 503 com mensagem em português; páginas mostram estado de erro.
- Sem sessão em rota de escrita → 401; editar post de outro → 403.
- Upload fora do tipo/tamanho → 400.

## Testes
- Vitest (`npm test`), junto com o spec da área provável.
- Testes de integração de `lib/data/posts.ts` rodando contra um branch Neon `test`
  (`TEST_DATABASE_URL`), recriado a partir de `main` com migrations aplicadas: criar/listar/buscar por bbox e raio,
  editar só como autor, `match_photos` com vetores sintéticos.
- ai-service: `test_database.py` com os mesmos casos de match contra o branch `test`.
- Manual: cadastro → login → criar post com foto → aparece no feed e no mapa → matches aparecem.

## Fora do escopo
- Regras e tela de XP (sub-projeto 3), área provável (sub-projeto 2).
- Login social (Google), notificações, deploy na Vercel.
