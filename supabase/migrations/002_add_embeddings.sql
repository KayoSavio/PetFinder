-- PetFinder V2 — Photo Embeddings for AI Matching
-- Enables visual similarity search using CLIP embeddings + pgvector

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================
-- PHOTO EMBEDDINGS TABLE
-- =====================
CREATE TABLE photo_embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  photo_url TEXT NOT NULL,
  embedding vector(512) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW index for fast approximate nearest neighbor search (cosine distance)
CREATE INDEX idx_photo_embeddings_hnsw
  ON photo_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Index for post lookup
CREATE INDEX idx_photo_embeddings_post_id ON photo_embeddings (post_id);

-- =====================
-- ROW LEVEL SECURITY
-- =====================
ALTER TABLE photo_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read photo embeddings"
  ON photo_embeddings FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage embeddings"
  ON photo_embeddings FOR ALL
  USING (true)
  WITH CHECK (true);

-- =====================
-- MATCH FUNCTION
-- =====================

-- Function to find similar photos using cosine similarity
CREATE OR REPLACE FUNCTION match_photos(
  query_embedding vector(512),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10
)
RETURNS TABLE(
  id UUID,
  post_id UUID,
  photo_url TEXT,
  similarity FLOAT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    pe.id,
    pe.post_id,
    pe.photo_url,
    1 - (pe.embedding <=> query_embedding) AS similarity
  FROM photo_embeddings pe
  INNER JOIN posts p ON p.id = pe.post_id
  WHERE p.status = 'active'
    AND p.type IN ('lost', 'help_request')
    AND 1 - (pe.embedding <=> query_embedding) > match_threshold
  ORDER BY pe.embedding <=> query_embedding ASC
  LIMIT match_count;
$$;
