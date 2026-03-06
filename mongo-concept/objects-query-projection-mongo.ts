export {};

/**
 * Query-optimized projection model derived from ObjectCoreDocument.
 *
 * Design goals:
 * - optimized for Mongo indexes and filtering
 * - keeps only queryable facts
 * - points back to source updateIds in the core document
 * - does not persist governance-derived final decisions
 * - can be rebuilt from the core object document
 */

type GeoPoint = {
  type: 'Point';
  coordinates: [number, number];
};

type ProjectionValueKind = 'text' | 'geo' | 'json';
type ProjectionCardinality = 'single' | 'multi';

/**
 * One flattened query row derived from one active update in the core object.
 *
 * This is the unit that should drive Mongo indexing and filtering:
 * - text queries
 * - geo queries
 * - exact-body / exact-value queries
 * - per-field filtering
 */
interface QueryFieldProjection {
  sourceUpdateId: string;
  updateType: string;
  creator: string;
  cardinality: ProjectionCardinality;
  valueKind: ProjectionValueKind;

  /**
   * Queryable payloads.
   * Only one should be populated according to valueKind.
   */
  valueText?: string;
  valueGeo?: GeoPoint;
  valueJson?: unknown;

  /**
   * Optional normalized value used for exact equality queries.
   * Example: canonical JSON string, lowercased normalized text, etc.
   */
  exactValueKey?: string;
}

/**
 * Object-level projection document.
 *
 * This document is intentionally small and flat enough to support practical
 * Mongo indexes, while still pointing back to the source updates in the core model.
 *
 * It is not authoritative for:
 * - governance-derived final validity
 * - decisive role resolution
 * - final multi-value ranking
 */
interface ObjectQueryProjectionDocument {
  objectId: string;
  objectType: string;
  creator: string;

  /**
   * Non-authoritative query hints copied from the core object when useful.
   */
  weight?: number;
  metaGroupId?: string;

  /**
   * Flattened active fields for direct querying.
   */
  queryFields: QueryFieldProjection[];

  /**
   * Prebuilt helper surfaces for common object-level queries.
   * These are derived from queryFields and exist only for indexing convenience.
   */
  searchText?: string;
  geoPoints?: GeoPoint[];
  exactValueKeys?: string[];
}

/**
 * Example place projection derived from the core object:
 *
 * {
 *   objectId: "place:central-park",
 *   objectType: "place",
 *   creator: "alice",
 *   weight: 152.4,
 *   metaGroupId: "nyc-parks",
 *   queryFields: [
 *     {
 *       sourceUpdateId: "upd-name-alice-1",
 *       updateType: "name",
 *       creator: "alice",
 *       cardinality: "single",
 *       valueKind: "text",
 *       valueText: "Central Park",
 *       exactValueKey: "central park"
 *     },
 *     {
 *       sourceUpdateId: "upd-map-alice-1",
 *       updateType: "map",
 *       creator: "alice",
 *       cardinality: "single",
 *       valueKind: "geo",
 *       valueGeo: { type: "Point", coordinates: [-73.9654, 40.7829] }
 *     },
 *     {
 *       sourceUpdateId: "upd-tag-bob-1",
 *       updateType: "tags",
 *       creator: "bob",
 *       cardinality: "multi",
 *       valueKind: "text",
 *       valueText: "park",
 *       exactValueKey: "park"
 *     },
 *     {
 *       sourceUpdateId: "upd-tag-carol-1",
 *       updateType: "tags",
 *       creator: "carol",
 *       cardinality: "multi",
 *       valueKind: "text",
 *       valueText: "nature",
 *       exactValueKey: "nature"
 *     }
 *   ],
 *   searchText: "central park park nature",
 *   geoPoints: [
 *     { type: "Point", coordinates: [-73.9654, 40.7829] }
 *   ],
 *   exactValueKeys: ["central park", "park", "nature"]
 * }
 */
