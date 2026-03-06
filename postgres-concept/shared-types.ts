/**
 * Shared types for PostgreSQL concept.
 * Adapted from mongo-concept2: enums and value kinds for row interfaces.
 * Position is inlined as columns in SQL; geo uses PostGIS (no GeoPoint wrapper in DB).
 */

export type UpdateCardinality = 'single' | 'multi';
export type ValidityVoteValue = 'for' | 'against';
export type ValueKind = 'text' | 'geo' | 'json';

/**
 * Inlined canonical event position columns.
 * All three child tables (object_updates, validity_votes, rank_votes) extend this.
 */
export interface CanonicalPositionColumns {
  block_num: number;
  trx_index: number;
  op_index: number;
  transaction_id: string;
}

/**
 * Application-level geo coordinates for building INSERT statements.
 * In SQL use: ST_MakePoint(lon, lat)::geography
 * When reading back without ST_AsGeoJSON, the driver returns WKB (unknown).
 */
export type GeoCoordinates = [lon: number, lat: number];
