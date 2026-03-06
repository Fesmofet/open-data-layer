/**
 * Query-optimized projection. Collection: object_query_projection.
 *
 * Restructured by value kind (textFields, geoFields, jsonFields) so Mongo can
 * use separate indexes: 2dsphere on geo, text on text, without multikey conflicts.
 * Not authoritative for governance-derived validity or ranking.
 */

import type { GeoPoint, UpdateCardinality } from './shared-types';

export interface TextFieldProjection {
  sourceUpdateId: string;
  updateType: string;
  creator: string;
  cardinality: UpdateCardinality;
  valueText: string;
  /** Normalized value for exact equality queries (e.g. lowercased). */
  exactValueKey?: string;
}

export interface GeoFieldProjection {
  sourceUpdateId: string;
  updateType: string;
  creator: string;
  cardinality: UpdateCardinality;
  valueGeo: GeoPoint;
}

export interface JsonFieldProjection {
  sourceUpdateId: string;
  updateType: string;
  creator: string;
  cardinality: UpdateCardinality;
  valueJson: unknown;
  /** Optional canonical key for exact match (e.g. stringified normalized JSON). */
  exactValueKey?: string;
}

export interface ObjectQueryProjectionDocument {
  objectId: string;
  objectType: string;
  creator: string;
  weight?: number;
  metaGroupId?: string;

  textFields: TextFieldProjection[];
  geoFields: GeoFieldProjection[];
  jsonFields: JsonFieldProjection[];

  /** Core seq at the time this projection was built; used for drift detection. */
  coreSeqAtBuild: number;
  lastRebuiltAt: Date;
}
