-- spykke V1 — Database Schema
-- Run this in Supabase SQL Editor to create all tables

-- Enable PostGIS for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- =====================
-- POSTS TABLE
-- =====================
CREATE TABLE posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT CHECK (type IN ('lost', 'found', 'help_request')) NOT NULL,
  status TEXT CHECK (status IN ('active', 'resolved')) DEFAULT 'active',
  urgency TEXT CHECK (urgency IN ('normal', 'urgent')) DEFAULT 'normal',
  title TEXT NOT NULL,
  description TEXT,
  species TEXT,
  size TEXT,
  color_tags TEXT[] DEFAULT '{}',
  event_datetime TIMESTAMPTZ,
  -- Primary pin location (lost/found/help_request)
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  -- Base location for help_request (center of search area)
  base_location GEOGRAPHY(POINT, 4326),
  search_radius_km NUMERIC,
  city TEXT,
  neighborhood TEXT,
  photos TEXT[] DEFAULT '{}',
  contact_whatsapp TEXT,
  contact_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Helper columns to expose lat/lng for queries
ALTER TABLE posts ADD COLUMN pin_lat NUMERIC GENERATED ALWAYS AS (ST_Y(location::geometry)) STORED;
ALTER TABLE posts ADD COLUMN pin_lng NUMERIC GENERATED ALWAYS AS (ST_X(location::geometry)) STORED;

-- =====================
-- SIGHTINGS TABLE
-- =====================
CREATE TABLE sightings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  datetime TIMESTAMPTZ NOT NULL,
  note TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- ALERT PREFERENCES
-- =====================
CREATE TABLE alert_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  center GEOGRAPHY(POINT, 4326) NOT NULL,
  radius_km NUMERIC NOT NULL DEFAULT 5,
  filters JSONB DEFAULT '{}',
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- REPORTS TABLE
-- =====================
CREATE TABLE reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- INDEXES (Critical for Performance)
-- =====================

-- Geospatial index on post locations — enables fast bbox / proximity queries
CREATE INDEX idx_posts_location ON posts USING GIST (location);

-- Compound index for filtered queries
CREATE INDEX idx_posts_status_type ON posts (status, type);

-- Temporal index for feed ordering
CREATE INDEX idx_posts_event_datetime ON posts (event_datetime DESC);

-- Sightings by post, ordered by time
CREATE INDEX idx_sightings_post_id ON sightings (post_id, datetime DESC);

-- Alert preferences geospatial index
CREATE INDEX idx_alerts_center ON alert_preferences USING GIST (center);

-- User lookups
CREATE INDEX idx_posts_user_id ON posts (user_id);
CREATE INDEX idx_alert_prefs_user_id ON alert_preferences (user_id);

-- =====================
-- ROW LEVEL SECURITY
-- =====================

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sightings ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Posts: anyone can read active, author can update/delete own
CREATE POLICY "Anyone can read active posts"
  ON posts FOR SELECT
  USING (status = 'active' OR auth.uid() = user_id);

CREATE POLICY "Authenticated users can create posts"
  ON posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authors can update own posts"
  ON posts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Authors can delete own posts"
  ON posts FOR DELETE
  USING (auth.uid() = user_id);

-- Sightings: anyone can read, authenticated can create
CREATE POLICY "Anyone can read sightings"
  ON sightings FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create sightings"
  ON sightings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Alert preferences: only owner
CREATE POLICY "Users can manage own alerts"
  ON alert_preferences FOR ALL
  USING (auth.uid() = user_id);

-- Reports: authenticated can create, only admin reads
CREATE POLICY "Authenticated users can create reports"
  ON reports FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- =====================
-- FUNCTIONS
-- =====================

-- Function to get posts within a bounding box
CREATE OR REPLACE FUNCTION get_posts_in_bbox(
  sw_lat DOUBLE PRECISION,
  sw_lng DOUBLE PRECISION,
  ne_lat DOUBLE PRECISION,
  ne_lng DOUBLE PRECISION,
  filter_type TEXT DEFAULT NULL,
  filter_species TEXT DEFAULT NULL,
  filter_urgency TEXT DEFAULT NULL
)
RETURNS SETOF posts
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM posts
  WHERE status = 'active'
    AND ST_Intersects(
      location,
      ST_MakeEnvelope(sw_lng, sw_lat, ne_lng, ne_lat, 4326)::geography
    )
    AND (filter_type IS NULL OR type = filter_type)
    AND (filter_species IS NULL OR species = filter_species)
    AND (filter_urgency IS NULL OR urgency = filter_urgency)
  ORDER BY event_datetime DESC;
$$;

-- Function to get posts near a point
CREATE OR REPLACE FUNCTION get_posts_near(
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION DEFAULT 50,
  filter_type TEXT DEFAULT NULL,
  filter_species TEXT DEFAULT NULL,
  page_limit INTEGER DEFAULT 20,
  page_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  post posts,
  distance_km DOUBLE PRECISION
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p,
    ST_Distance(p.location, ST_MakePoint(user_lng, user_lat)::geography) / 1000 AS distance_km
  FROM posts p
  WHERE p.status = 'active'
    AND ST_DWithin(p.location, ST_MakePoint(user_lng, user_lat)::geography, radius_km * 1000)
    AND (filter_type IS NULL OR p.type = filter_type)
    AND (filter_species IS NULL OR p.species = filter_species)
  ORDER BY distance_km ASC
  LIMIT page_limit
  OFFSET page_offset;
$$;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
