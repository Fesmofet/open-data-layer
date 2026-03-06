/**
 * One row per update. Table: object_updates.
 *
 * CanonicalPosition inlined via CanonicalPositionColumns. UpdateValue becomes value_kind
 * plus nullable value_text, value_geo (PostGIS), value_json. search_vector and
 * value_text_normalized are generated/trigger-maintained columns.
 */

import type {
  CanonicalPositionColumns,
  UpdateCardinality,
  ValueKind,
} from './shared-types';

export interface ObjectUpdateRow extends CanonicalPositionColumns {
  update_id: string;
  object_id: string;
  update_type: string;
  creator: string;
  cardinality: UpdateCardinality;
  created_at_unix: number;
  value_kind: ValueKind;
  value_text: string | null;
  /**
   * PostGIS geography(Point, 4326).
   * On INSERT: use ST_MakePoint(lon, lat)::geography
   * On SELECT: driver returns WKB binary unless you cast via ST_AsGeoJSON()
   */
  value_geo: unknown;
  value_json: unknown;
  /** Generated column: LOWER(TRIM(value_text)). Use for case-insensitive exact match. */
  value_text_normalized: string | null;
  /** tsvector, auto-populated by trigger from value_text */
  search_vector: unknown;
}
