/**
 * Shared API contracts for the query service (Mongo and Postgres).
 * Used by both apps to keep request/response shapes identical.
 */

/** Mocked governance: owner, admins, trusted. Applied at request time as a mask. */
export interface GovernanceContext {
  owner: string;
  admins: string[];
  trusted: string[];
}

/** Geo bounding box (e.g. min/max lng/lat). */
export interface GeoBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

/** Geo radius query (center + meters). */
export interface GeoRadius {
  lng: number;
  lat: number;
  radiusMeters: number;
}

/** Text search mode. */
export type TextSearchMode = 'contains' | 'fulltext';

/** Query params for listing places: geo, tags, pagination, governance, body match, text search, rejection. */
export interface QueryPlacesDto {
  /** Bounding box filter (optional). */
  bbox?: GeoBox;
  /** Radius filter (optional). */
  radius?: GeoRadius;
  /** Tags: match places that have all of these tags. */
  tags?: string[];
  /** Tags overlap: match places that have any of these tags. */
  tagsAny?: string[];
  /** Pagination: page (1-based) and page size. */
  page?: number;
  limit?: number;
  /** Request-time governance context (mocked). */
  governance?: GovernanceContext;
  /** Exact update body match (string or normalized JSON). */
  updateBodyExact?: string;
  /** Text search query (name/body). */
  textQuery?: string;
  /** Text search mode: contains (ILIKE/like) or fulltext (tsvector). */
  textMode?: TextSearchMode;
  /** Include rejected updates in results (with finalStatus/decisiveRole/rejectedBy). */
  includeRejected?: boolean;
  /** Governance actor to apply for rejection resolution (e.g. current user). */
  governanceActor?: string;
  /** Decision source hint (e.g. owner | admin). */
  decisionSource?: string;
}

/** Query-time derived validity (vote semantics). */
export type FinalStatus = 'VALID' | 'REJECTED';

/** Single place view: object_type=place with resolved single name, map, and multiple tags. */
export interface PlaceDto {
  objectId: string;
  objectType: string;
  creator: string;
  /** Resolved single update: name. */
  name?: string;
  /** Resolved single update: map (geo point or geometry). */
  map?: GeoPointDto;
  /** Resolved multiple updates: tags. */
  tags: string[];
  /** Applied governance (mocked). */
  governance?: GovernanceContext;
  /** Query-time derived: decisive validity from governance + raw vote. */
  finalStatus?: FinalStatus;
  /** Query-time derived: role that was decisive (owner > admin > trusted). */
  decisiveRole?: 'owner' | 'admin' | 'trusted';
  /** Raw voter evidence from storage (who voted against, if any). */
  rejectedBy?: string;
}

/** Geo point (lng/lat). */
export interface GeoPointDto {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}

/** Result page for place queries. */
export interface PlaceQueryResult {
  data: PlaceDto[];
  total: number;
}

/** Repository contract for place queries (composition or decomposition backend). */
export interface IPlaceQueryRepository {
  findById(objectId: string, governance?: GovernanceContext): Promise<PlaceDto | null>;
  query(dto: QueryPlacesDto): Promise<PlaceQueryResult>;
}
