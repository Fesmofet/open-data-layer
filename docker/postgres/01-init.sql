-- PostGIS for geo queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Composition: denormalized read model (rejection resolved at query time from rejected_by + governance)
CREATE TABLE IF NOT EXISTS places_read (
  object_id TEXT PRIMARY KEY,
  object_type TEXT NOT NULL,
  creator TEXT NOT NULL,
  name TEXT,
  map geography(Point, 4326),
  tags TEXT[] DEFAULT '{}',
  body TEXT,
  update_body_exact TEXT,
  rejected_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_places_read_object_type ON places_read (object_type);
CREATE INDEX IF NOT EXISTS idx_places_read_map ON places_read USING GIST (map);
CREATE INDEX IF NOT EXISTS idx_places_read_tags ON places_read USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_places_read_update_body_exact ON places_read (update_body_exact) WHERE update_body_exact IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_places_read_body_gin ON places_read USING GIN (to_tsvector('simple', COALESCE(name, '') || ' ' || COALESCE(body, '')));

-- Decomposition: objects + updates
CREATE TABLE IF NOT EXISTS place_objects (
  object_id TEXT PRIMARY KEY,
  object_type TEXT NOT NULL,
  creator TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_place_objects_type ON place_objects (object_type);

CREATE TABLE IF NOT EXISTS place_updates (
  id SERIAL PRIMARY KEY,
  object_id TEXT NOT NULL REFERENCES place_objects (object_id),
  update_type TEXT NOT NULL,
  value_text TEXT,
  value_geo geography(Point, 4326),
  value_tags TEXT[] DEFAULT '{}',
  body TEXT,
  update_body_exact TEXT,
  rejected_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_place_updates_object ON place_updates (object_id, update_type);
CREATE INDEX IF NOT EXISTS idx_place_updates_geo ON place_updates USING GIST (value_geo) WHERE value_geo IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_place_updates_tags ON place_updates USING GIN (value_tags) WHERE update_type = 'tags';
CREATE INDEX IF NOT EXISTS idx_place_updates_body_exact ON place_updates (update_body_exact) WHERE update_body_exact IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_place_updates_body_gin ON place_updates USING GIN (to_tsvector('simple', COALESCE(value_text, '') || ' ' || COALESCE(body, '')));
