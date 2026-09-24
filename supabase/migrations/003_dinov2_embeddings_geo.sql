-- PetFinder V3 — DINOv2 embeddings (384 dims) + match geográfico
--
-- ATENÇÃO: os embeddings antigos do CLIP (512 dims) são incompatíveis.
-- Esta migration APAGA os embeddings existentes. Depois de rodar,
-- reprocesse tudo com: POST http://localhost:8000/embeddings/batch

-- =====================
-- 1. Recria a coluna de embedding com 384 dimensões
-- =====================
DROP INDEX IF EXISTS idx_photo_embeddings_hnsw;
DELETE FROM photo_embeddings;
ALTER TABLE photo_embeddings DROP COLUMN embedding;
ALTER TABLE photo_embeddings ADD COLUMN embedding vector(384) NOT NULL;

-- Recria o índice HNSW (cosine)
CREATE INDEX idx_photo_embeddings_hnsw
  ON photo_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- =====================
-- 2. Match com filtro geográfico e direção de busca
-- =====================
-- Remove a versão antiga (assinatura diferente)
DROP FUNCTION IF EXISTS match_photos(vector, FLOAT, INT);

CREATE OR REPLACE FUNCTION match_photos(
  query_embedding vector(384),
  match_threshold FLOAT DEFAULT 0.60,
  match_count INT DEFAULT 10,
  query_lat FLOAT DEFAULT NULL,
  query_lng FLOAT DEFAULT NULL,
  max_distance_km FLOAT DEFAULT NULL,
  search_types TEXT[] DEFAULT ARRAY['lost', 'help_request'],
  exclude_post_id UUID DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  post_id UUID,
  photo_url TEXT,
  similarity FLOAT,
  distance_km FLOAT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    pe.id,
    pe.post_id,
    pe.photo_url,
    1 - (pe.embedding <=> query_embedding) AS similarity,
    CASE
      WHEN query_lat IS NOT NULL AND query_lng IS NOT NULL THEN
        ST_Distance(
          p.location,
          ST_SetSRID(ST_MakePoint(query_lng, query_lat), 4326)::geography
        ) / 1000.0
      ELSE NULL
    END AS distance_km
  FROM photo_embeddings pe
  INNER JOIN posts p ON p.id = pe.post_id
  WHERE p.status = 'active'
    AND p.type = ANY(search_types)
    AND (exclude_post_id IS NULL OR p.id != exclude_post_id)
    AND 1 - (pe.embedding <=> query_embedding) > match_threshold
    AND (
      query_lat IS NULL OR query_lng IS NULL OR max_distance_km IS NULL
      OR ST_DWithin(
        p.location,
        ST_SetSRID(ST_MakePoint(query_lng, query_lat), 4326)::geography,
        max_distance_km * 1000.0
      )
    )
  ORDER BY pe.embedding <=> query_embedding ASC
  LIMIT match_count;
$$;
