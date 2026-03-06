export {};

/**
 * Minimal core-only object model derived from the spec:
 * - generic across object types
 * - stores object metadata plus active updates only
 * - keeps raw validity/rank state
 * - does not store duplicated derived state
 * - does not store governance-derived final decisions
 */

type GeoPoint = {
  type: 'Point';
  coordinates: [number, number];
};

type UpdateCardinality = 'single' | 'multi';
type ValidityVoteValue = 'for' | 'against';

/**
 * Canonical event position.
 * All "latest wins" semantics must use this ordering.
 */
interface CanonicalPosition {
  blockNum: number;
  trxIndex: number;
  opIndex: number;
  transactionId: string;
}

/**
 * Active raw validity vote projection.
 * A remove operation is represented by deleting the active vote entry.
 */
interface ActiveValidityVote {
  voter: string;
  vote: ValidityVoteValue;
  position: CanonicalPosition;
}

/**
 * Active raw rank vote projection for multi-cardinality updates only.
 */
interface ActiveRankVote {
  voter: string;
  rank: number; // 1..10000
  position: CanonicalPosition;
}

interface TextUpdateValue {
  valueKind: 'text';
  valueText: string;
}

interface GeoUpdateValue {
  valueKind: 'geo';
  valueGeo: GeoPoint;
}

interface JsonUpdateValue {
  valueKind: 'json';
  valueJson: unknown;
}

type UpdateValue = TextUpdateValue | GeoUpdateValue | JsonUpdateValue;

interface UpdateDocumentBase {
  updateId: string;
  updateType: string;
  creator: string;
  cardinality: UpdateCardinality;
  createdAtUnix: number;
  createdPosition: CanonicalPosition;
  value: UpdateValue;
  validityVotes: ActiveValidityVote[];
}

interface SingleValueUpdateDocument extends UpdateDocumentBase {
  cardinality: 'single';
}

interface MultiValueUpdateDocument extends UpdateDocumentBase {
  cardinality: 'multi';
  rankVotes: ActiveRankVote[];
}

type ObjectUpdateDocument = SingleValueUpdateDocument | MultiValueUpdateDocument;

/**
 * Core object document.
 * This is the minimal stored truth for one object and its active updates.
 */
interface ObjectCoreDocument {
  objectId: string;
  objectType: string;
  creator: string;
  weight?: number;
  metaGroupId?: string;
  updates: ObjectUpdateDocument[];
}
