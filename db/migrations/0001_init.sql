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
