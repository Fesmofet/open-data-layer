-- PostgreSQL concept schema: objects_core, object_updates, validity_votes, rank_votes.
-- Requires: PostGIS extension for geo. No projection table; query directly via JOINs, tsvector, PostGIS.

CREATE EXTENSION IF NOT EXISTS postgis;

-- ---------------------------------------------------------------------------
-- objects_core
-- ---------------------------------------------------------------------------
CREATE TABLE objects_core (
  object_id   TEXT NOT NULL PRIMARY KEY,
  object_type TEXT NOT NULL,
  creator     TEXT NOT NULL,
  weight      DOUBLE PRECISION,
  meta_group_id TEXT,
  seq         BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_objects_core_object_type_weight ON objects_core (object_type, weight DESC NULLS LAST);
CREATE INDEX idx_objects_core_creator ON objects_core (creator);

-- ---------------------------------------------------------------------------
-- object_updates
-- ---------------------------------------------------------------------------
CREATE TABLE object_updates (
  update_id       TEXT NOT NULL PRIMARY KEY,
  object_id       TEXT NOT NULL REFERENCES objects_core (object_id) ON DELETE CASCADE,
  update_type     TEXT NOT NULL,
  creator         TEXT NOT NULL,
  cardinality     TEXT NOT NULL CHECK (cardinality IN ('single', 'multi')),
  created_at_unix BIGINT NOT NULL,
  block_num       BIGINT NOT NULL,
  trx_index       INT NOT NULL,
  op_index        INT NOT NULL,
  transaction_id  TEXT NOT NULL,
  value_kind      TEXT NOT NULL CHECK (value_kind IN ('text', 'geo', 'json')),
  value_text      TEXT,
  value_geo       GEOGRAPHY(Point, 4326),
  value_json      JSONB,
  -- Generated column for case-insensitive exact match queries. Requires PG 12+.
  value_text_normalized TEXT GENERATED ALWAYS AS (LOWER(TRIM(value_text))) STORED,
  search_vector   TSVECTOR,
  CONSTRAINT chk_value_kind_text   CHECK (value_kind != 'text' OR (value_text IS NOT NULL AND value_geo IS NULL AND value_json IS NULL)),
  CONSTRAINT chk_value_kind_geo   CHECK (value_kind != 'geo' OR (value_geo IS NOT NULL AND value_text IS NULL AND value_json IS NULL)),
  CONSTRAINT chk_value_kind_json  CHECK (value_kind != 'json' OR (value_json IS NOT NULL AND value_text IS NULL AND value_geo IS NULL))
);

CREATE INDEX idx_object_updates_object_id_update_type ON object_updates (object_id, update_type);
CREATE INDEX idx_object_updates_search_vector ON object_updates USING GIN (search_vector);
CREATE INDEX idx_object_updates_value_geo ON object_updates USING GIST (value_geo);
CREATE INDEX idx_object_updates_update_type_value_text ON object_updates (update_type, value_text) WHERE value_text IS NOT NULL;
-- Case-insensitive exact match (uses the generated column; faster than LOWER(value_text) = $1).
CREATE INDEX idx_object_updates_update_type_value_text_normalized ON object_updates (update_type, value_text_normalized) WHERE value_text_normalized IS NOT NULL;
-- Enforces at the DB level that only one active update exists per object+type when cardinality='single'.
CREATE UNIQUE INDEX uq_object_updates_single ON object_updates (object_id, update_type) WHERE cardinality = 'single';

-- Trigger: keep search_vector in sync with value_text
CREATE OR REPLACE FUNCTION object_updates_search_vector_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.value_kind = 'text' AND NEW.value_text IS NOT NULL THEN
    NEW.search_vector := to_tsvector('english', NEW.value_text);
  ELSE
    NEW.search_vector := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_object_updates_search_vector
  BEFORE INSERT OR UPDATE OF value_text, value_kind ON object_updates
  FOR EACH ROW
  EXECUTE PROCEDURE object_updates_search_vector_trigger();

-- ---------------------------------------------------------------------------
-- validity_votes
-- ---------------------------------------------------------------------------
CREATE TABLE validity_votes (
  update_id      TEXT NOT NULL REFERENCES object_updates (update_id) ON DELETE CASCADE,
  object_id      TEXT NOT NULL REFERENCES objects_core (object_id) ON DELETE CASCADE,
  voter          TEXT NOT NULL,
  vote           TEXT NOT NULL CHECK (vote IN ('for', 'against')),
  block_num      BIGINT NOT NULL,
  trx_index      INT NOT NULL,
  op_index       INT NOT NULL,
  transaction_id TEXT NOT NULL,
  PRIMARY KEY (update_id, voter)
);

CREATE INDEX idx_validity_votes_object_id ON validity_votes (object_id);

-- ---------------------------------------------------------------------------
-- rank_votes
-- ---------------------------------------------------------------------------
CREATE TABLE rank_votes (
  update_id      TEXT NOT NULL REFERENCES object_updates (update_id) ON DELETE CASCADE,
  object_id      TEXT NOT NULL REFERENCES objects_core (object_id) ON DELETE CASCADE,
  voter          TEXT NOT NULL,
  rank           INT NOT NULL CHECK (rank >= 1 AND rank <= 10000),
  rank_context   TEXT NOT NULL,
  block_num      BIGINT NOT NULL,
  trx_index      INT NOT NULL,
  op_index       INT NOT NULL,
  transaction_id TEXT NOT NULL,
  PRIMARY KEY (update_id, voter, rank_context)
);

CREATE INDEX idx_rank_votes_object_id ON rank_votes (object_id);
